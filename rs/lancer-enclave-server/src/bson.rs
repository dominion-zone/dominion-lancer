use std::{
    fmt::Display,
    ops::{Deref, DerefMut},
};

use axum::{
    body::Bytes,
    extract::{FromRequest, Request},
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Serialize, de::DeserializeOwned};

pub struct Bson<T>(pub T);

#[derive(Debug)]
pub enum BsonRejection {
    BytesRead(axum::extract::rejection::BytesRejection),
    MissingContentType,
    BsonError(bson::de::Error),
}

impl Display for BsonRejection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BsonRejection::BytesRead(err) => write!(f, "{}", err),
            BsonRejection::MissingContentType => write!(f, "Missing content type"),
            BsonRejection::BsonError(err) => write!(f, "{}", err),
        }
    }
}

impl IntoResponse for BsonRejection {
    fn into_response(self) -> axum::response::Response {
        (
            StatusCode::BAD_REQUEST,
            [(
                header::CONTENT_TYPE,
                HeaderValue::from_static(mime::TEXT_PLAIN_UTF_8.as_ref()),
            )],
            self.to_string(),
        )
            .into_response()
    }
}

impl<S, T> FromRequest<S> for Bson<T>
where
    T: DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = BsonRejection;

    async fn from_request(req: Request, _s: &S) -> Result<Self, Self::Rejection> {
        if bson_content_type(&req) {
            let bytes = Bytes::from_request(req, _s)
                .await
                .map_err(|e| BsonRejection::BytesRead(e))?;
            match bson::from_slice(&bytes) {
                Ok(value) => Ok(Bson(value)),
                Err(err) => Err(BsonRejection::BsonError(err)),
            }
        } else {
            Err(BsonRejection::MissingContentType)
        }
    }
}

fn bson_content_type<B>(req: &Request<B>) -> bool {
    let content_type = if let Some(content_type) = req.headers().get(header::CONTENT_TYPE) {
        content_type
    } else {
        return false;
    };

    let content_type = if let Ok(content_type) = content_type.to_str() {
        content_type
    } else {
        return false;
    };

    let mime = if let Ok(mime) = content_type.parse::<mime::Mime>() {
        mime
    } else {
        return false;
    };

    let is_binary_content_type = mime.type_() == "application"
        && (mime.subtype() == "octet-stream"
            || mime.suffix().map_or(false, |name| name == "octet-stream"));

    is_binary_content_type
}

impl<T> Deref for Bson<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> DerefMut for Bson<T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl<T> From<T> for Bson<T> {
    fn from(inner: T) -> Self {
        Self(inner)
    }
}

impl<T> IntoResponse for Bson<T>
where
    T: Serialize,
{
    fn into_response(self) -> Response {
        match bson::to_raw_document_buf(&self.0) {
            Ok(buf) => (
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static(mime::APPLICATION_OCTET_STREAM.as_ref()),
                )],
                Bytes::from(buf.into_bytes()),
            )
                .into_response(),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static(mime::TEXT_PLAIN_UTF_8.as_ref()),
                )],
                err.to_string(),
            )
                .into_response(),
        }
    }
}
