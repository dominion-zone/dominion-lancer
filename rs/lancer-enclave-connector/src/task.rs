use std::{
    env,
    io::Cursor,
    path::{Path, PathBuf},
    str::FromStr,
    sync::{Arc, mpsc::Sender},
};

use aes_gcm::{Aes256Gcm, KeyInit, Nonce, aead::Aead};
use anyhow::{Context, bail};
use async_tempfile::TempDir;
use lancer_transport::{
    response::{EncryptedBlobData, LancerRunResponse},
    task::LancerRunTask,
};
use rsa::{Oaep, RsaPrivateKey};
use seal::{EncryptionInput, seal_encrypt};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sui_types::base_types::ObjectID;
use tokio::{
    fs,
    io::AsyncWrite,
    process::{Child, Command},
    sync::mpsc::{self, UnboundedReceiver, UnboundedSender},
};
use tokio_tar::{Archive, Builder as ArchiveBuilder, EntryType};

use crate::state::State;

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

const PUBLIC_FIELD: u8 = 0;
const PRIVATE_FIELD: u8 = 1;
const ERROR_FIELD: u8 = 2;

pub struct Task {
    pub submission_hash: Vec<u8>,
    pub bug_bounty_id: ObjectID,
    pub finding_id: ObjectID,
    pub escrow_id: ObjectID,
    pub working_dir: PathBuf,
    pub runner_killer: UnboundedSender<()>,
}

pub struct RunnerOutput {
    pub public_report: Option<Vec<u8>>,
    pub private_report: Option<Vec<u8>>,
    pub error_message: Option<Vec<u8>>,
}

impl Task {
    pub async fn from_encrypted(
        rsa_private_key: &RsaPrivateKey,
        task: &LancerRunTask,
    ) -> anyhow::Result<(Self, impl Future<Output = anyhow::Result<RunnerOutput>>)> {
        let submission = [
            task.iv.clone(),
            task.encrypted_file.clone(),
            task.encrypted_key.clone(),
            task.bug_bounty_id.to_vec(),
        ]
        .concat();
        let submission_hash = Sha256::digest(&submission);

        let decrypted_key = rsa_private_key.decrypt(Oaep::new::<Sha256>(), &task.encrypted_key)?;

        let cipher = Aes256Gcm::new_from_slice(&decrypted_key)?;
        let nonce = Nonce::from_slice(&task.iv);

        let data = cipher
            .decrypt(nonce, task.encrypted_file.as_ref())
            .map_err(|e| anyhow::anyhow!(e))?;

        Self::from_data(
            submission_hash.to_vec(),
            data,
            task.bug_bounty_id,
            task.finding_id,
            task.escrow_id,
        )
        .await
    }

    pub async fn from_data(
        submission_hash: Vec<u8>,
        data: Vec<u8>,
        bug_bounty_id: ObjectID,
        finding_id: ObjectID,
        escrow_id: ObjectID,
    ) -> anyhow::Result<(Self, impl Future<Output = anyhow::Result<RunnerOutput>>)> {
        let working_dir = TempDir::new().await?;
        let mut archive = Archive::new(data.as_slice());
        archive.unpack(&working_dir).await?;
        if fs::try_exists(working_dir.join("output")).await? {
            fs::remove_dir_all(working_dir.join("output")).await?;
        }
        if !fs::try_exists(working_dir.join("input")).await? {
            bail!("input directory not found");
        }
        if !fs::try_exists(working_dir.join("input/glu/scenario.glu")).await? {
            bail!("input/glu/scenario.glu not found");
        }
        fs::symlink(
            env::current_dir()?.join("lancer"),
            working_dir.join("input/glu/lancer"),
        )
        .await?;

        let runner = Command::new("./lancer-runner")
            .arg(working_dir.dir_path())
            .spawn()?;

        let (runner_killer, runner_control) = mpsc::unbounded_channel();

        Ok((
            Self {
                submission_hash,
                bug_bounty_id,
                finding_id,
                escrow_id,
                working_dir: working_dir.dir_path().clone(),
                runner_killer,
            },
            Self::wait_for_results(working_dir, runner, runner_control),
        ))
    }

    pub async fn wait_for_results(
        working_dir: TempDir,
        mut runner: Child,
        mut runner_control: UnboundedReceiver<()>,
    ) -> anyhow::Result<RunnerOutput> {
        let status = tokio::select! {
            _ = runner_control.recv() => {
                runner.kill().await?;
                bail!("Runner killed");
            }
            status = runner.wait() => status?,
        };
        if !status.success() {
            return Err(anyhow::anyhow!("Runner failed with status: {}", status));
        }
        let output = if fs::try_exists(working_dir.join("output/error.txt")).await? {
            // Error report
            RunnerOutput {
                public_report: None,
                private_report: None,
                error_message: Some(fs::read(working_dir.join("output/error.txt")).await?),
            }
        } else if fs::try_exists(working_dir.join("output/public_summary.json")).await? {
            let private_report = {
                let mut tar = ArchiveBuilder::new(vec![]);
                add_dir_to_tar(&mut tar, &working_dir.join("input"), &working_dir).await?;
                tar.append_dir("output", &working_dir.join("output"))
                    .await?;
                let mut logs = fs::File::open(&working_dir.join("output/logs.json")).await?;
                tar.append_file("output/logs.json", &mut logs).await?;
                tar.finish().await?;
                tar.into_inner().await?
            };
            let public_report = {
                let mut tar = ArchiveBuilder::new(vec![]);
                tar.append_dir("output", &working_dir.join("output"))
                    .await?;
                let mut summary =
                    fs::File::open(&working_dir.join("output/public_summary.json")).await?;
                tar.append_file("output/public_summary.json", &mut summary)
                    .await?;
                tar.finish().await?;
                tar.into_inner().await?
            };
            RunnerOutput {
                public_report: Some(public_report),
                private_report: Some(private_report),
                error_message: None,
            }
        } else {
            let public_report = {
                let mut tar = ArchiveBuilder::new(vec![]);
                add_dir_to_tar(&mut tar, &working_dir, &working_dir).await?;
                tar.finish().await?;
                tar.into_inner().await?
            };
            RunnerOutput {
                public_report: Some(public_report),
                private_report: None,
                error_message: None,
            }
        };

        working_dir.drop_async().await;
        Ok(output)
    }

    pub async fn prepare_response(
        &self,
        RunnerOutput {
            public_report,
            private_report,
            error_message,
        }: RunnerOutput,
        state: Arc<State>,
    ) -> anyhow::Result<LancerRunResponse> {
        let id_base = self.finding_id.to_vec();
        let public_report = if let Some(report) = public_report {
            Some(state.encrypt(
                [id_base.clone(), vec![PUBLIC_FIELD]].concat(),
                EncryptionInput::Aes256Gcm {
                    data: report,
                    aad: Some(id_base.clone()),
                },
            )?)
        } else {
            None
        };

        let private_report = if let Some(report) = private_report {
            Some(state.encrypt(
                [id_base.clone(), vec![PRIVATE_FIELD]].concat(),
                EncryptionInput::Aes256Gcm {
                    data: report,
                    aad: Some(id_base.clone()),
                },
            )?)
        } else {
            None
        };

        let error_message = if let Some(report) = error_message {
            Some(state.encrypt(
                [id_base.clone(), vec![ERROR_FIELD]].concat(),
                EncryptionInput::Aes256Gcm {
                    data: report,
                    aad: Some(id_base.clone()),
                },
            )?)
        } else {
            None
        };

        Ok(LancerRunResponse {
            public_report,
            private_report,
            error_message,
            signature: self.submission_hash.clone(),
        })
    }

    /*
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
    }*/

    pub async fn run(state: Arc<State>, task: &LancerRunTask) -> anyhow::Result<LancerRunResponse> {
        let (task, results) = Task::from_encrypted(&state.rsa_private_key, task).await?;
        // TODO: encryption
        let task = Arc::new(task);

        if let Some(old_task) = state.task.write().await.replace(task.clone()) {
            let _ = old_task.runner_killer.send(()); // igonre error
        }

        let runner_output = results.await?;

        task.prepare_response(runner_output, state.clone()).await
    }
}
