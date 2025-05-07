use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    routing::get,
};
use server::{Server, TaskStatus};

pub mod server;
pub mod task;

async fn get_public_key(State(server): State<Arc<Server>>) -> String {
    server.get_public_key()
}

async fn get_task_status(State(server): State<Arc<Server>>) -> Json<Option<TaskStatus>> {
    Json(server.task_status().await)
}

async fn start_task(State(server): State<Arc<Server>>) {}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/public_key", get(get_public_key))
        .route("/task_status", get(get_task_status))
        .route("/start_task", get(start_task))
        .with_state(Arc::new(Server::new()))
        .layer(DefaultBodyLimit::disable());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:9300").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
