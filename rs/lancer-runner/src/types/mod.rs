use gluon::{vm, Thread};

pub mod uint;

pub fn install(vm: &Thread) -> vm::Result<()> {
    uint::install(vm)?;
    Ok(())
}
