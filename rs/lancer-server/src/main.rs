use std::str::FromStr;

use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce, aead::Aead};
use axum::{
    Router,
    body::Body,
    extract::DefaultBodyLimit,
    http::{Method, StatusCode, header},
    response::Response,
    routing::{get, post},
};
use axum_extra::extract::Multipart;
use base64::prelude::*;
use rand::thread_rng as rng;
use rsa::{Oaep, RsaPrivateKey, pkcs8::EncodePublicKey};
use sha2::{Digest, Sha256};
use shared_crypto::intent::{Intent, IntentMessage};
use sui_sdk::{
    types::crypto::PublicKey, verify_personal_message_signature::verify_personal_message_signature,
};
use sui_types::{
    base_types::SuiAddress,
    crypto::{Signature, SignatureScheme, SuiSignature, ToFromBytes},
};
use tokio::fs;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowHeaders, Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;

#[tokio::main]
async fn main() {
    let mut rng = rng();
    let private_key = RsaPrivateKey::new(&mut rng, 2048).unwrap();
    let private_key_clone = private_key.clone();
    let public_key = private_key.to_public_key();

    // SPKI DER (binary)
    let spki_der = public_key.to_public_key_der().unwrap().as_ref().to_vec();
    let base64_spki = BASE64_STANDARD.encode(&spki_der);
    let base64_spki_clone = base64_spki.clone();

    let public_key = async move || {
        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .header(header::CONNECTION, "close")
            .body(Body::from(base64_spki_clone))
            .unwrap()
    };

    // build our application with a single route
    let app = Router::new()
        .route("/public_key", get(public_key))
        .route(
            "/new_finding",
            post(
                async move |mut multipart: Multipart| -> Result<String, String> {
                    println!("Received new finding");
                    let mut encrypted_file = vec![];
                    let mut encrypted_key = vec![];
                    let mut iv = vec![];
                    let mut salt = vec![];
                    let mut user = None;
                    let mut signature = None;

                    while let Some(field) = multipart.next_field().await.unwrap() {
                        let name = field.name().unwrap().to_string();
                        println!("Field name: {}", name);
                        let data = field.bytes().await.expect("field data").to_vec();
                        match name.as_str() {
                            "encryptedFile" => encrypted_file = data,
                            "encryptedKey" => encrypted_key = data,
                            "iv" => iv = data,
                            "salt" => salt = data,
                            "user" => {
                                user = Some(
                                    SuiAddress::from_str(&String::from_utf8(data).unwrap())
                                        .unwrap(),
                                )
                            }
                            "signature" => {
                                signature = Some(
                                    Signature::from_str(&String::from_utf8(data).unwrap()).unwrap(),
                                );
                            }
                            _ => (),
                        }
                    }

                    let data = [
                        salt.clone(),
                        encrypted_file.clone(),
                        encrypted_key.clone(),
                        iv.clone(),
                    ]
                    .concat();
                    let data = Sha256::digest(&data);
                    println!("hash: {}", BASE64_STANDARD.encode(data));

                    let user = user.unwrap();
                    let signature = signature.unwrap();
                    verify_personal_message_signature(signature.into(), &data, user, None).await.unwrap();
                    /*signature.verify_secure(
                        &IntentMessage::new(Intent::personal_message(), data),
                        user,
                        signature.scheme(),
                    ).map_err(|e| e.to_string())?;*/

                    let decrypted_key = private_key_clone
                        .decrypt(Oaep::new::<Sha256>(), &encrypted_key)
                        .map_err(|e| e.to_string())?;

                    let cipher =
                        Aes256Gcm::new_from_slice(&decrypted_key).map_err(|e| e.to_string())?;
                    let nonce = Nonce::from_slice(&iv);

                    let data = cipher
                        .decrypt(nonce, encrypted_file.as_ref())
                        .map_err(|e| e.to_string())?;
                    println!("Decrypted data: {} bytes", data.len());

                    fs::write("input.tar", &data)
                        .await
                        .map_err(|e| e.to_string())?;
                    Ok("Ok".to_string())
                },
            ),
        )
        .layer(
            CorsLayer::new()
                // allow `GET` and `POST` when accessing the resource
                .allow_methods([Method::GET, Method::POST])
                // allow requests from any origin
                .allow_origin(Any)
                .allow_headers(AllowHeaders::any()),
        )
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(50 * 1024 * 1024));
    /*
    .layer(
        ServiceBuilder::new().layer(
            CorsLayer::new()
                // allow `GET` and `POST` when accessing the resource
                .allow_methods([Method::GET, Method::POST])
                // allow requests from any origin
                .allow_origin(Any)
                .allow_headers(AllowHeaders::any()),
        ),
    );
    */

    // run our app with hyper, listening globally on port 3000
    let listener = tokio::net::TcpListener::bind("0.0.0.0:9200").await.unwrap();
    println!("Listening on http://localhost:9200");
    axum::serve(listener, app).await.unwrap();
}
