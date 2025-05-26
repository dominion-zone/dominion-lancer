use std::sync::Arc;

use crate::post_new_finding::post_new_finding;
use anyhow_http::response::HttpJsonResult;
use axum::{
    Router,
    extract::{DefaultBodyLimit, State},
    http::Method,
    response::IntoResponse,
    routing::{get, post},
};
use base64::prelude::*;
use config::Config;
use server::Server;
use tokio::fs;
use tower_http::cors::{AllowHeaders, Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;

pub mod config;
pub mod post_new_finding;
pub mod server;
pub mod worker;

async fn get_public_key(State(server): State<Arc<Server>>) -> HttpJsonResult<impl IntoResponse> {
    Ok(BASE64_STANDARD.encode(&server.identity().await?.decryption_public_key))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    /*
        fs::write(
            "lancer-server.json",
            &serde_json::to_vec_pretty(&Config::default())?,
        )
        .await?;
    */
    let config: Config = serde_json::from_slice(&fs::read("lancer-server.json").await?)?;
    let cors = config.cors;
    let (server, worker) = Server::new(config).await?;

    let app = Router::new()
        .route("/public_key", get(get_public_key))
        .route("/new_finding", post(post_new_finding))
        .with_state(server)
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(50 * 1024 * 1024));

    let app = if cors {
        app.layer(
            CorsLayer::new()
                // allow `GET` and `POST` when accessing the resource
                .allow_methods([Method::GET, Method::POST])
                // allow requests from any origin
                .allow_origin(Any)
                .allow_headers(AllowHeaders::any()),
        )
    } else {
        app
    };

    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind("0.0.0.0:9200").await?;
    println!("Listening on http://localhost:9200");
    axum::serve(listener, app).await?;
    worker.await??;
    Ok(())
}
