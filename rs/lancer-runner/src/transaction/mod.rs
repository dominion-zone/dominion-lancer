use builder::WBuilder;
use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    primitive, record,
    vm::{self, ExternModule},
};
use transaction::WTransaction;

use crate::sui::WSuiAddress;

pub mod argument;
pub mod builder;
pub mod transaction;
pub mod object_arg;

fn load_transaction(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Builder => WBuilder,
            type Transaction => WTransaction,
            new_builder => primitive!(1, "lancer.transaction.prim.builder", WBuilder::new),
            u8 => primitive!(2, "lancer.transaction.prim.u8", async fn WBuilder::pure::<u8>),
            u16 => primitive!(2, "lancer.transaction.prim.u16", async fn WBuilder::pure::<u16>),
            u32 => primitive!(2, "lancer.transaction.prim.u32", async fn WBuilder::pure::<u32>),
            u64 => primitive!(2, "lancer.transaction.prim.u64", async fn WBuilder::pure::<u64>),
            // u128 => primitive!(2, "lancer.transaction.prim.u128", async fn WBuilder::pure::<u128>), 
            // u256 => primitive!(2, "lancer.transaction.prim.u256", async fn WBuilder::pure::<u256>),
            bool => primitive!(2, "lancer.transaction.prim.bool", async fn WBuilder::pure::<bool>),
            address => primitive!(2, "lancer.transaction.prim.address", async fn WBuilder::pure::<WSuiAddress>),
            object_ref => primitive!(2, "lancer.transaction.prim.object_ref", async fn WBuilder::object_ref),
            publish_upgradeable => primitive!(
                3,
                "lancer.transaction.prim.publish_upgradeable",
                async fn WBuilder::publish_upgradeable),
            publish_immutable => primitive!(
                3,
                "lancer.transaction.prim.publish_immutable",
                async fn WBuilder::publish_immutable),
            move_call => primitive!(6, "lancer.transaction.prim.move_call", async fn WBuilder::move_call),
            pay => primitive!(4, "lancer.transaction.prim.pay", async fn WBuilder::pay),
            finish => primitive!(1, "lancer.transaction.prim.finish", async fn WBuilder::finish),
        ),
    )
}

pub fn install_transaction(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<WBuilder>("lancer.transaction.prim.Builder", &[])?;
    vm.register_type::<WTransaction>("lancer.transaction.prim.Transaction", &[])?;

    add_extern_module_with_deps(
        vm,
        "lancer.transaction.prim",
        load_transaction,
        vec![
            "lancer.transaction.types".to_string(),
            "lancer.sui.types".to_string(),
        ],
    );
    Ok(())
}
