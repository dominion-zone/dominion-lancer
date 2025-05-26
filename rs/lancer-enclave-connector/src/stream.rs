use anyhow::Context;
use tokio::{
    io::{AsyncRead, AsyncWrite},
    net::TcpStream,
};
use tokio_util::{
    bytes::Bytes,
    codec::{Framed, LengthDelimitedCodec},
};
use tokio_vsock::{VsockAddr, VsockStream};

pub enum Stream {
    Tcp(TcpStream),
    Vsock(VsockStream),
}

const VMADDR_CID_PARENT: u32 = 3;

impl Stream {
    pub async fn connect(port: u32, use_tcp: bool) -> anyhow::Result<Self> {
        if use_tcp {
            let tcp_stream = TcpStream::connect(format!("127.0.0.1:{}", port))
                .await
                .context("Failed to connect to TCP stream")?;
            println!("Connected to TCP stream on port {}", port);
            Ok(Stream::Tcp(tcp_stream))
        } else {
            let vsock_stream = VsockStream::connect(VsockAddr::new(VMADDR_CID_PARENT, port))
                .await
                .context("Failed to connect to VSOCK stream")?;
            println!("Connected to VSOCK stream on port {}", port);
            Ok(Stream::Vsock(vsock_stream))
        }
    }
}

impl AsyncRead for Stream {
    fn poll_read(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            Stream::Tcp(tcp_stream) => {
                AsyncRead::poll_read(std::pin::Pin::new(tcp_stream), cx, buf)
            }
            Stream::Vsock(vsock_stream) => {
                AsyncRead::poll_read(std::pin::Pin::new(vsock_stream), cx, buf)
            }
        }
    }
}

impl AsyncWrite for Stream {
    fn poll_write(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        buf: &[u8],
    ) -> std::task::Poll<std::io::Result<usize>> {
        match self.get_mut() {
            Stream::Tcp(tcp_stream) => {
                AsyncWrite::poll_write(std::pin::Pin::new(tcp_stream), cx, buf)
            }
            Stream::Vsock(vsock_stream) => {
                AsyncWrite::poll_write(std::pin::Pin::new(vsock_stream), cx, buf)
            }
        }
    }

    fn poll_flush(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            Stream::Tcp(tcp_stream) => AsyncWrite::poll_flush(std::pin::Pin::new(tcp_stream), cx),
            Stream::Vsock(vsock_stream) => {
                AsyncWrite::poll_flush(std::pin::Pin::new(vsock_stream), cx)
            }
        }
    }

    fn poll_shutdown(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<std::io::Result<()>> {
        match self.get_mut() {
            Stream::Tcp(tcp_stream) => {
                AsyncWrite::poll_shutdown(std::pin::Pin::new(tcp_stream), cx)
            }
            Stream::Vsock(vsock_stream) => {
                AsyncWrite::poll_shutdown(std::pin::Pin::new(vsock_stream), cx)
            }
        }
    }

    fn poll_write_vectored(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
        bufs: &[std::io::IoSlice<'_>],
    ) -> std::task::Poll<Result<usize, std::io::Error>> {
        match self.get_mut() {
            Stream::Tcp(tcp_stream) => {
                AsyncWrite::poll_write_vectored(std::pin::Pin::new(tcp_stream), cx, bufs)
            }
            Stream::Vsock(vsock_stream) => {
                AsyncWrite::poll_write_vectored(std::pin::Pin::new(vsock_stream), cx, bufs)
            }
        }
    }

    fn is_write_vectored(&self) -> bool {
        match self {
            Stream::Tcp(tcp_stream) => AsyncWrite::is_write_vectored(tcp_stream),
            Stream::Vsock(vsock_stream) => AsyncWrite::is_write_vectored(vsock_stream),
        }
    }
}
