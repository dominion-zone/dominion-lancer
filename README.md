# Dominion Lancer

**Dominion Lancer** is a secure and confidential platform for responsible vulnerability disclosure on the SUI blockchain. It enables white hat hackers to submit isolated exploit scripts that run inside trusted enclaves and produce verifiable evidence of bugs—without revealing sensitive details until appropriate. Protocol developers can safely validate exploits and compensate researchers through automated, on-chain workflows.

---

## 📁 Repository Structure

### 🧠 SUI Smart Contracts (`sui/`)
- **`sui/dominion_lancer/`**  
  Core contracts that define the bug bounty system and the structured vulnerability submission flow.
  
- **`sui/dominion_lancer_runner/`**  
  Payment contracts used to fund and authorize enclave execution. Designed to work independently of the bounty logic.

---

### 🦀 Rust Backend (`rs/`)
- **`rs/lancer-runner/`**  
  Executes submitted scripts in an isolated test SUI cluster, inside the enclave.

- **`rs/lancer-enclave-connector/`**  
  Runs inside a secure enclave (e.g., AWS Nitro Enclaves). Connects vsock for encrypted script execution requests, performs encryption/decryption, and delegates isolated script execution to `lancer-runner`.

- **`rs/lancer-server/`**  
  Public-facing service that interacts with the enclave. Handles file uploads to Walrus, writes verified outputs to the blockchain, and manages payment for enclave usage.

- **`rs/lancer-transport/`**  
  Shared serialization/deserialization layer between `lancer-server` and `lancer-enclave-connector`.

- **`rs/snapshot-explorer/`**  
  Utility for extracting and reproducing partial historical snapshots of the SUI blockchain. Used to initialize test clusters with realistic state data for scenario reconstruction.

---

### 🌐 Frontend & CLI (`ts/`)
- **`ts/dominion-lancer-app/`**  
  Web application built with Solid.js for protocol owners and researchers to submit, review, and manage vulnerability reports.

- **`ts/dominion-lancer-cli/`**  
  Command-line tool for interacting with Dominion Lancer contracts.

---

### 🔬 Gluon Scripts (`glu/`)
- **Library for exploit scripts**  
  Provides essential functions used by `lancer-runner` and submitted scripts for test cluster setup, exploit execution, and post-analysis.
  Written in [Gluon](https://gluon-lang.org/), a statically typed, Rust-based embeddable language with type inference and built-in support for [effects](https://en.wikipedia.org/wiki/Effect_system), which enable clean and modular expression of restricted interactions with the environment.

---

### 📦 Examples (`examples/`)
Includes a complete working demonstration of the `dummy_pool` exploit scenario.

- **`examples/dummy_pool/`**  
  Contains the submission bundle:  
  - `input/sui/` — Contains the Move source code for the dummy_pool contract. Used by the script to compile and deploy the contract to the test cluster during the preparation phase.  
  - `input/glu/` — Contains the Gluon script implementing the scenario logic (`scenario.glu`).


- **`examples/cetus_checked_shlw/`** *(Work in progress)*  
  Demonstrates how Dominion Lancer could have been used to prevent the [Cetus incident on May 22, 2025](https://cetusprotocol.notion.site/Cetus-Incident-Report-May-22-2025-Attack-Disclosure-1ff1dbf3ac8680d7a98de6158597d416), had it been deployed at the time.
  The scenario uses a partial snapshot of the SUI blockchain from epoch 760 and a minimal token setup. The protocol is not granted any administrative privileges, relying solely on behavior available through standard user-level interactions.


## 🛡️ Core Features

- Enclave-based script execution with no host-level visibility
- Script-controlled partial state disclosure
- Verifiable logs with on-chain attestation (via Nautilus)
- Decentralized encrypted result storage (via Walrus + SEAL)
- Token-based payment for compute resources

---

## 🔗 Learn More

- Website: [https://lancer.dominion.zone/](https://lancer.dominion.zone/)
- Video: [https://www.youtube.com/watch?v=u7Ec8fik164](https://www.youtube.com/watch?v=u7Ec8fik164)

---

## 📜 License

This project is licensed under the **BSD 2-Clause License** – see the [LICENSE](LICENSE) file for details.  

