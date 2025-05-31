use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    primitive, record,
    vm::{self, ExternModule},
};
pub mod coin;

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type Coin => coin::WCoin,
            coin_to_bytes => primitive!(
                1,
                "lancer.framework.prim.coin_to_bytes",
                coin::WCoin::to_bytes
            ),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    add_extern_module_with_deps(
        vm,
        "lancer.framework.prim",
        load,
        vec!["lancer.framework.types".to_string()],
    );
    Ok(())
}
