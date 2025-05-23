use std::{str::FromStr, sync::Arc, time::Duration};

use anyhow::{Context, bail};
use anyhow_http::response::HttpJsonResult;
use axum::{extract::State, response::IntoResponse, Json};
use axum_extra::extract::Multipart;
use base64::prelude::*;
use lancer_transport::task::LancerRunTask;
use move_core_types::language_storage::StructTag;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sui_sdk::rpc_types::{SuiData, SuiMoveValue, SuiObjectDataOptions};
use sui_types::{Identifier, TypeTag, base_types::ObjectID, dynamic_field::DynamicFieldName};

use crate::{server::Server};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PostNewFindingResponse {}

pub async fn post_new_finding_handler(
    server: Arc<Server>,
    mut multipart: Multipart,
) -> anyhow::Result<PostNewFindingResponse> {
    println!("Received new finding");
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
    println!(
        "id: {}, hash: {}",
        finding_id,
        BASE64_STANDARD.encode(submission_hash)
    );

    let finding = server
        .sui_client
        .read_api()
        .get_object_with_options(finding_id, SuiObjectDataOptions::new().with_content())
        .await?
        .data
        .context("finding data not found")?
        .content
        .unwrap()
        .try_into_move()
        .context("finding is not a move object")?;

    if finding.type_
        != (StructTag {
            address: server.config.finding_origin_id.clone().into(),
            module: Identifier::from_str("finding").unwrap(),
            name: Identifier::from_str("Finding").unwrap(),
            type_params: vec![],
        })
    {
        bail!("finding is not a Finding");
    }

    let versioned = finding
        .fields
        .field_value("inner")
        .context("inner not found")?;
    let versioned = match versioned {
        SuiMoveValue::Struct(versioned) => versioned,
        _ => bail!("finding is not a Versioned"),
    };
    let inner_id = match versioned.field_value("id").context("id not found")? {
        SuiMoveValue::UID { id } => id,
        _ => bail!("wrong id type"),
    };
    let version = match versioned
        .field_value("version")
        .context("version not found")?
    {
        SuiMoveValue::String(version) => u64::from_str(&version)?,
        _ => bail!("wrong version type"),
    };

    let inner = server
        .sui_client
        .read_api()
        .get_dynamic_field_object(
            inner_id,
            DynamicFieldName {
                type_: TypeTag::U64,
                value: version.to_string().into(), // U64 must be encoded into a string
            },
        )
        .await?
        .data
        .context("inner data not found")?
        .content
        .context("inner content not found")?
        .try_into_move()
        .context("inner is not a move object")?
        .fields
        .field_value("value")
        .context("value not found")?;

    let inner = match inner {
        SuiMoveValue::Struct(inner) => inner,
        _ => bail!("inner is not a struct"),
    };
    let finding_hash = inner
        .field_value("submission_hash")
        .context("submission_hash not found")?;
    let finding_hash = match finding_hash {
        SuiMoveValue::Vector(data) => data
            .into_iter()
            .map(|x| match x {
                SuiMoveValue::Number(x) => Ok(u8::try_from(x)?),
                _ => bail!("finding_hash is not a vector"),
            })
            .collect::<anyhow::Result<Vec<u8>>>()?,
        _ => bail!("finding_hash is not a vector"),
    };
    if finding_hash != submission_hash.as_slice() {
        bail!("finding_hash does not match");
    }

    server.task_sender.send_timeout(LancerRunTask {
        iv,
        encrypted_file,
        encrypted_key,
        bug_bounty_id,
        finding_id,
        escrow_id,
    }, Duration::from_secs(10)).await?;

    Ok(PostNewFindingResponse {})
}

pub async fn post_new_finding(
    State(server): State<Arc<Server>>,
    multipart: Multipart,
) -> HttpJsonResult<impl IntoResponse> {
    Ok(Json(post_new_finding_handler(server, multipart).await.unwrap()))
}
