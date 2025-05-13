use serde::{Deserialize, Serialize};
use tokio::process::Child;

pub struct Report {
    pub logs: String,
    pub public_summary: String,
}

pub enum Stage {
    Running(Child),
    Finished(Result<Report, String>),
}

pub struct Task {
    pub id: Vec<u8>, // submission hash
    pub stage: Stage,
}

#[derive(Clone, Serialize, Deserialize)]
pub enum Status {
    Running,
    Finished,
    Error(String),
}

impl Task {
    /*
    pub fn new(id: Vec<u8>) -> Self {
        Task {
            id,
            stage: Stage::Running(Child::new()),
        }
    }*/

    pub fn get_id(&self) -> Vec<u8> {
        self.id.clone()
    }

    pub fn get_status(&self) -> Status {
        match &self.stage {
            Stage::Running(_) => Status::Running,
            Stage::Finished(Ok(_)) => Status::Finished,
            Stage::Finished(Err(e)) => Status::Error(e.clone()),
        }
    }
}