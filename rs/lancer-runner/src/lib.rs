#![allow(non_local_definitions)]

use compiler::install_compiler;
use gluon::{
    Thread,
    import::add_extern_module_with_deps,
    record,
    vm::{self, ExternModule},
};
use rpc::install_rpc;
use sui::install;

pub mod compiler;
pub mod reporting;
pub mod rpc;
pub mod sui;
pub mod temp_wallet;
pub mod test_cluster;
pub mod transaction;
pub mod temp_file;
pub mod framework;
pub mod types;
/*
pub struct PreparationDump {
    pub sql: String,
    pub sender: SuiAddress,
    pub available_private_keys: HashSet<SuiAddress>,
}
*/

/*

    async fn commit(&mut self) -> ExecResult<()> {
        let current_wallet = self.current_wallet();
        match self {
            Lancer::Prepare {
                test_cluster,
                dump_sender,
                keys,
                ..
            } => {
                let test_cluster = test_cluster.start_if_needed().await?;
                let sql = dump_db(test_cluster).await?;
                dump_sender
                    .send(PreparationDump {
                        sql,
                        sender: current_wallet.unwrap().0,
                        available_private_keys: HashSet::from_iter(keys.keys().cloned()),
                    })
                    .await
                    .map_err(|e| e.to_string())?;
            }
            _ => {
                return Err("Test cluster is not in preparation state".to_string());
            }
        }
        take(self, |lancer| {
            if let Lancer::Prepare { test_cluster, .. } = lancer {
                let test_cluster = test_cluster.into_inner().unwrap();
                Lancer::Run {
                    test_cluster,
                    reporting: Reporting::Public,
                    keys: HashMap::new(),
                }
            } else {
                unreachable!()
            }
        });
        Ok(())
    }


    fn set_reporting(&mut self, reporting: Reporting) -> ExecResult<()> {
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run { reporting: r, .. } => {
                *r = reporting;
            }
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
        Ok(())
    }

    fn borrow_reporting(&self) -> ExecResult<&Reporting> {
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run { reporting, .. } => Ok(&reporting),
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
    }

    fn borrow_reporting_mut(&mut self) -> ExecResult<&mut Reporting> {
        match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run { reporting, .. } => Ok(reporting),
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        }
    }

    async fn stop(&mut self) -> ExecResult<FinalReport> {
        let current_wallet = self.current_wallet();
        let report = match self {
            Lancer::Unintialized => {
                return Err("Lancer is not initialized".to_string());
            }
            Lancer::Prepare { .. } => {
                return Err("Test cluster is not running".to_string());
            }
            Lancer::Run {
                test_cluster,
                reporting,
                keys,
                ..
            } => {
                let private_sql = dump_db(test_cluster).await?;
                let public_report: Vec<Object> = match reporting {
                    Reporting::Public => {
                        vec![]
                    }
                    Reporting::Partial { owned_by, objects } => {
                        let mut public_report: Vec<Object> = vec![];
                        for address in owned_by.iter() {
                            let mut cursor = None;
                            loop {
                                let page = test_cluster
                                    .fullnode_handle
                                    .sui_client
                                    .read_api()
                                    .get_owned_objects(address.clone(), None, cursor, None)
                                    .await
                                    .map_err(|e| e.to_string())?;
                                for r in page.data {
                                    public_report.push(
                                        test_cluster
                                            .get_object_from_fullnode_store(&r.object_id().unwrap())
                                            .await
                                            .ok_or("Failed to get object")?,
                                    );
                                }
                                if !page.has_next_page {
                                    break;
                                }
                                cursor = page.next_cursor;
                            }
                        }
                        for id in objects.iter() {
                            public_report.push(
                                test_cluster
                                    .get_object_from_fullnode_store(id)
                                    .await
                                    .ok_or("Failed to get object")?,
                            );
                        }
                        public_report
                    }
                    Reporting::HidingObjects(object_ids) => todo!("Implement hiding objects"),
                };
                test_cluster.stop_all_validators().await;
                FinalReport {
                    reporting: Reporting::Public,
                    public_report,
                    sql: private_sql,
                    sender: current_wallet.unwrap().0,
                    available_private_keys: HashSet::from_iter(keys.keys().cloned()),
                }
            }
            Lancer::Dropped => {
                return Err("Lancer is dropped".to_string());
            }
        };
        *self = Lancer::Dropped;
        Ok(report)
    }
}

pub struct FinalReport {
    pub reporting: Reporting,
    pub public_report: Vec<Object>,
    pub sql: String,
    pub sender: SuiAddress,
    pub available_private_keys: HashSet<SuiAddress>,
}

    pub async fn report_public(&self) -> IO<()> {
        self.0.write().await.set_reporting(Reporting::Public).into()
    }

    pub async fn report_owner_by(&self, owner: Option<WSuiAddress>) -> IO<()> {
        let owner = owner.unwrap_or(self.current_wallet().await.unwrap()).0;
        let mut inner = self.0.write().await;
        if matches!(inner.borrow_reporting(), Ok(Reporting::Partial { .. })) {
            if let Ok(Reporting::Partial { owned_by, .. }) = inner.borrow_reporting_mut() {
                owned_by.insert(owner);
                IO::Value(())
            } else {
                unreachable!()
            }
        } else {
            inner
                .set_reporting(Reporting::Partial {
                    owned_by: HashSet::from([owner]),
                    objects: HashSet::new(),
                })
                .into()
        }
    }

    pub async fn report_objects(&self, new_objects: Vec<WSuiAddress>) -> IO<()> {
        let new_objects = new_objects.into_iter().map(|x| x.0.into());
        let mut inner = self.0.write().await;
        if matches!(inner.borrow_reporting(), Ok(Reporting::Partial { .. })) {
            if let Ok(Reporting::Partial { objects, .. }) = inner.borrow_reporting_mut() {
                objects.extend(new_objects);
                IO::Value(())
            } else {
                unreachable!()
            }
        } else {
            inner
                .set_reporting(Reporting::Partial {
                    owned_by: HashSet::new(),
                    objects: HashSet::from_iter(new_objects),
                })
                .into()
        }
    }

    pub async fn hiding_objects(&self, objects: Vec<WSuiAddress>) -> IO<()> {
        let objects = objects.into_iter().map(|x| x.0.into());
        let mut inner = self.0.write().await;
        if matches!(inner.borrow_reporting(), Ok(Reporting::HidingObjects(_))) {
            if let Ok(Reporting::HidingObjects(target)) = inner.borrow_reporting_mut() {
                target.extend(objects);
                IO::Value(())
            } else {
                unreachable!()
            }
        } else {
            inner
                .set_reporting(Reporting::HidingObjects(HashSet::from_iter(objects)))
                .into()
        }
    }

    pub async fn stop(&self) -> IO<FinalReport> {
        self.0.write().await.stop().await.into()
    }
}
*/

fn load_lancer(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            /*
            lancer => LancerRef::default(),
            type Lancer => LancerRef,
            initialize => primitive!(
                2,
                "lancer.prim.initialize",
                async fn LancerRef::initialize),
            current_wallet => primitive!(
                1,
                "lancer.prim.current_wallet",
                async fn LancerRef::current_wallet),
            start => primitive!(1, "lancer.prim.start", async fn LancerRef::start),
            commit => primitive!(1, "lancer.prim.commit", async fn LancerRef::commit),
            execute => primitive!(
                3,
                "lancer.prim.execute",
                async fn LancerRef::execute),
            generate_keypair => primitive!(
                1,
                "lancer.prim.generate_keypair",
                async fn LancerRef::generate_keypair),

            report_public => primitive!(
                1,
                "lancer.prim.report_public",
                async fn LancerRef::report_public),
            report_owner_by => primitive!(
                2,
                "lancer.prim.report_owner_by",
                async fn LancerRef::report_owner_by),
            report_objects => primitive!(
                2,
                "lancer.prim.report_objects",
                async fn LancerRef::report_objects),
            hiding_objects => primitive!(
                2,
                "lancer.prim.hiding_objects",
                async fn LancerRef::hiding_objects),
                */
        ),
    )
}

pub fn install_lancer(vm: &Thread) -> vm::Result<()> {
    types::install(vm)?;
    install(vm)?;
    install_compiler(vm)?;
    transaction::install(vm)?;
    install_rpc(vm)?;

    temp_wallet::install(vm)?;
    test_cluster::install(vm)?;
    temp_file::install(vm)?;
    framework::install(vm)?;

    add_extern_module_with_deps(
        vm,
        "lancer.prim",
        load_lancer,
        vec!["lancer.rpc.types".to_string()],
    );
    Ok(())
}
