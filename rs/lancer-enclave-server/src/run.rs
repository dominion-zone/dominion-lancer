use std::{io::Cursor, path::Path, str::FromStr, sync::Arc};

use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::Aead};
use anyhow::Context;
use anyhow_http::response::HttpJsonResult;
use async_tempfile::TempDir;
use axum::{
    Json,
    extract::{Multipart, State},
    response::IntoResponse,
};
use lancer_transport::response::LancerRunResponse;
use rsa::Oaep;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sui_types::base_types::ObjectID;
use tokio::{fs, io::AsyncWrite};
use tokio_tar::{Archive, Builder as ArchiveBuilder, EntryType};

use crate::{bson::Bson, server::Server};

async fn add_dir_to_tar<W>(
    tar: &mut ArchiveBuilder<W>,
    path: &Path,
    base: &Path,
) -> std::io::Result<()>
where
    W: AsyncWrite + Unpin + Send,
{
    let mut entries = fs::read_dir(path).await?;

    while let Some(entry) = entries.next_entry().await? {
        let file_type = entry.file_type().await?;
        let full_path = entry.path();
        let relative_path = full_path.strip_prefix(base).unwrap();

        if file_type.is_dir() {
            tar.append_dir(relative_path, &full_path).await?;
            Box::pin(add_dir_to_tar(tar, &full_path, base)).await?;
        } else if file_type.is_file() {
            let mut file = fs::File::open(&full_path).await?;
            tar.append_file(relative_path, &mut file).await?;
        } else {
            continue;
        }
    }

    Ok(())
}

pub async fn run_handler(
    server: Arc<Server>,
    mut multipart: Multipart,
) -> anyhow::Result<LancerRunResponse> {
    let mut iv = None;
    let mut encrypted_file = None;
    let mut encrypted_key = None;
    let mut bug_bounty_id = None;
    let mut finding_id = None;
    let mut escrow_id = None;

    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or_default().to_string();
        let data = field.bytes().await?.to_vec();
        match name.as_str() {
            "iv" => iv = Some(data),
            "encryptedFile" => encrypted_file = Some(data),
            "encryptedKey" => encrypted_key = Some(data),
            "bugBountyId" => {
                bug_bounty_id = Some(ObjectID::from_str(&String::from_utf8(data)?)?);
            }
            "findingId" => {
                finding_id = Some(ObjectID::from_str(&String::from_utf8(data)?)?);
            }
            "escrowId" => {
                escrow_id = Some(ObjectID::from_str(&String::from_utf8(data)?)?);
            }
            _ => (),
        }
    }
    let iv = iv.context("iv not found")?;
    let encrypted_file = encrypted_file.context("encryptedFile not found")?;
    let encrypted_key = encrypted_key.context("encryptedKey not found")?;
    let bug_bounty_id = bug_bounty_id.context("bugBountyId not found")?;
    let finding_id = finding_id.context("findingId not found")?;
    let escrow_id = escrow_id.context("escrowId not found")?;

    let data = [
        iv.clone(),
        encrypted_file.clone(),
        encrypted_key.clone(),
        bug_bounty_id.to_vec(),
    ]
    .concat();
    let submission_hash = Sha256::digest(&data);

    let decrypted_key = server
        .rsa_private_key
        .decrypt(Oaep::new::<Sha256>(), &encrypted_key)?;

    let cipher = Aes256Gcm::new_from_slice(&decrypted_key)?;
    let nonce = Nonce::from_slice(&iv);

    let data = cipher
        .decrypt(nonce, encrypted_file.as_ref())
        .map_err(|e| anyhow::anyhow!(e))?;

    let mut archive = Archive::new(data.as_slice());
    let mut entries = archive.entries()?;
    /*
    TODO
    use futures::stream::StreamExt;
    while let Some(file) = entries.next().await {
        let file = file?;
        match file.header().entry_type() {
            EntryType::Regular => todo!(),
            EntryType::Directory => todo!(),
            _ => todo!(),
        }
        println!("{}", f.path().unwrap().display());
    }

    let dir = TempDir::new().await?;
    */
    let base = Path::new("../lancer-runner/examples/simple");
    let (public_report, private_report, error_message) =
        if fs::try_exists(base.join("output/error.txt")).await? {
            // Error report
            (None, None, Some::<Vec<u8>>(vec![]))
        } else if fs::try_exists(base.join("output/public_summary.json")).await? {
            let private_report = {
                let mut tar = ArchiveBuilder::new(vec![]);
                add_dir_to_tar(&mut tar, &base.join("input"), base).await?;
                tar.append_dir("output", &base.join("output")).await?;
                let mut logs = fs::File::open(&base.join("output/logs.json")).await?;
                tar.append_file("output/logs.json", &mut logs).await?;
                tar.finish().await?;
                tar.into_inner().await?
            };
            let public_report = {
                let mut tar = ArchiveBuilder::new(vec![]);
                tar.append_dir("output", &base.join("output")).await?;
                let mut summary = fs::File::open(&base.join("output/public_summary.json")).await?;
                tar.append_file("output/public_summary.json", &mut summary)
                    .await?;
                tar.finish().await?;
                tar.into_inner().await?
            };
            (Some(public_report), Some(private_report), None)
        } else {
            let public_report = {
                let mut tar = ArchiveBuilder::new(vec![]);
                add_dir_to_tar(&mut tar, base, base).await?;
                tar.finish().await?;
                tar.into_inner().await?
            };
            (Some(public_report), None, None)
        };
    // TODO: encrypt the reports
    public_report.as_ref().map(|report| {
        let blob_id = server.get_blob_id(&report).unwrap();
        println!("public report blob id: {}", blob_id);
    });
    private_report.as_ref().map(|report| {
        let blob_id = server.get_blob_id(&report).unwrap();
        println!("private report blob id: {}", blob_id);
    });
    error_message.as_ref().map(|report| {
        let blob_id = server.get_blob_id(&report).unwrap();
        println!("error message blob id: {}", blob_id);
    });

    Ok(LancerRunResponse {
        public_report,
        private_report,
        error_message,
        signature: submission_hash.to_vec(),
    })
}

pub async fn run(
    State(server): State<Arc<Server>>,
    multipart: Multipart,
) -> HttpJsonResult<impl IntoResponse> {
    Ok(Bson(run_handler(server, multipart).await.unwrap()))
}
