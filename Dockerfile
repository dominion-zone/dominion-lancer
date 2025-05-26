FROM ubuntu
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libstdc++6 \
    git
COPY ./.move /root/.move
WORKDIR /lancer
COPY ./target/release/lancer-runner \
     ./target/release/lancer-enclave-connector \
     ./config/lancer-enclave-connector.json \
     ./
COPY ./glu/lancer/ ./lancer/
EXPOSE 9300
CMD [ "./lancer-enclave-connector" ]