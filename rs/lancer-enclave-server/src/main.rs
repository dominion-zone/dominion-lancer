use std::{any, sync::Arc};

use crate::bson::Bson;
use anyhow_http::response::HttpJsonResult;
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    response::IntoResponse,
    routing::{get, post},
};
use axum_extra::extract::Multipart;
use config::Config;
use server::Server;
use task::Task;
use tokio::fs;

pub mod bson;
pub mod config;
pub mod server;
pub mod task;

async fn get_public_key(State(server): State<Arc<Server>>) -> String {
    server.get_public_key()
}

pub async fn run(
    State(server): State<Arc<Server>>,
    multipart: Multipart,
) -> HttpJsonResult<impl IntoResponse> {
    Ok(Bson(Task::run(server, multipart).await.unwrap()))
}
/*
async fn get_task_status(State(server): State<Arc<Server>>) -> Json<Option<TaskStatus>> {
    Json(server.task_status().await)
}

async fn start_task(State(server): State<Arc<Server>>) {}
*/

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // fs::write("lancer-enclave-server.json", &serde_json::to_vec_pretty(&Config::default())?).await?;
    let config: Config = serde_json::from_slice(&fs::read("lancer-enclave-server.json").await?)?;
    let app = Router::new()
        .route("/public_key", get(get_public_key))
        // .route("/task_status", get(get_task_status))
        .route("/run", post(run))
        .with_state(Arc::new(Server::new(config)))
        .layer(DefaultBodyLimit::disable());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:9300").await.unwrap();
    axum::serve(listener, app).await?;
    Ok(())
}
