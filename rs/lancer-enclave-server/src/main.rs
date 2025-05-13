use std::sync::Arc;

use axum::{
    extract::{DefaultBodyLimit, State}, routing::{get, post}, Json, Router
};
use server::{Server};

pub mod server;
pub mod run;
pub mod bson;
// pub mod task;

async fn get_public_key(State(server): State<Arc<Server>>) -> String {
    server.get_public_key()
}

/*
async fn get_task_status(State(server): State<Arc<Server>>) -> Json<Option<TaskStatus>> {
    Json(server.task_status().await)
}

async fn start_task(State(server): State<Arc<Server>>) {}
*/

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/public_key", get(get_public_key))
        // .route("/task_status", get(get_task_status))
        .route("/run", post(run::run))
        .with_state(Arc::new(Server::new()))
        .layer(DefaultBodyLimit::disable());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:9300").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
