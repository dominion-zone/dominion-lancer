use std::{str::FromStr, sync::Arc};

use crate::post_new_finding::post_new_finding;
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce, aead::Aead};
use axum::{
    Router,
    body::Body,
    extract::{DefaultBodyLimit, State},
    http::{Method, StatusCode, header},
    response::Response,
    routing::{get, post},
};
use axum_extra::extract::Multipart;
use base64::prelude::*;
use config::Config;
use move_core_types::language_storage::StructTag;
use rand::thread_rng as rng;
use rsa::{Oaep, RsaPrivateKey, pkcs8::EncodePublicKey};
use server::Server;
use sha2::{Digest, Sha256};
use shared_crypto::intent::{Intent, IntentMessage};
use sui_sdk::{
    rpc_types::{SuiData, SuiObjectDataOptions},
    types::crypto::PublicKey,
    verify_personal_message_signature::verify_personal_message_signature,
};
use sui_types::{
    base_types::{ObjectID, SuiAddress},
    crypto::{Signature, SignatureScheme, SuiSignature, ToFromBytes},
};
use tokio::fs;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowHeaders, Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;

pub mod config;
pub mod post_new_finding;
pub mod server;
pub mod worker;

async fn get_public_key() -> String {
    reqwest::get("http://localhost:9300/public_key")
        .await
        .unwrap()
        .text()
        .await
        .unwrap()
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
    let (server, worker) = Server::new(config).await.unwrap();

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
