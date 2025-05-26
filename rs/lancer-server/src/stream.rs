use anyhow::Context;
use tokio::{
    io::{AsyncRead, AsyncWrite},
    net::{TcpListener, TcpStream},
};
use tokio_util::{
    bytes::Bytes,
    codec::{Framed, LengthDelimitedCodec},
};
use tokio_vsock::{VsockAddr, VsockListener, VsockStream};

const VMADDR_CID_ANY: u32 = 0xFFFFFFFF;

pub enum Listener {
    Tcp(TcpListener),
    Vsock(VsockListener),
}

impl Listener {
    pub async fn bind(port: u32, use_tcp: bool) -> anyhow::Result<Self> {
        if use_tcp {
            let tcp_listener = TcpListener::bind(format!("0.0.0.0:{}", port))
                .await
                .context("[worker] Failed to bind TCP listener")?;
            println!("[worker] TCP listener bound on port {}", port);
            Ok(Listener::Tcp(tcp_listener))
        } else {
            let vsock_listener = VsockListener::bind(VsockAddr::new(VMADDR_CID_ANY, port))
                .context("[worker] Failed to bind VSOCK listener")?;
            println!("[worker] VSOCK listener bound on port {}", port);
            Ok(Listener::Vsock(vsock_listener))
        }
    }

    pub async fn accept(&self) -> anyhow::Result<Stream> {
        match self {
            Listener::Tcp(tcp_listener) => {
                let (tcp_stream, addr) = tcp_listener.accept().await.context("Failed to accept TCP connection")?;
                println!("[worker] Accepted TCP connection from {}", addr.ip());
                Ok(Stream::Tcp(tcp_stream))
            }
            Listener::Vsock(vsock_listener) => {
                let (vsock_stream, addr) = vsock_listener.accept().await.context("Failed to accept VSOCK connection")?;
                println!("[worker] Accepted VSOCK connection from {}", addr.cid());
                Ok(Stream::Vsock(vsock_stream))
            }
        }
    }
}

pub enum Stream {
    Tcp(TcpStream),
    Vsock(VsockStream),
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
