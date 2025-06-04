use std::{ops::Deref, str::FromStr};

use anyhow::{Context, bail};
use gluon::{
    Thread,
    import::add_extern_module,
    primitive, record,
    vm::{
        self, ExternModule,
        api::{OpaqueValue, UserdataValue},
        types::VmInt,
    },
};
use gluon_codegen::{Trace, Userdata, VmType};
use move_core_types::u256::{U256, U256_NUM_BYTES};
use num_bigint_dig::BigUint;
use num_traits::ToPrimitive;
use num_traits::{
    Pow,
    identities::{One, Zero},
};
use std::ops::*;

#[derive(Clone, Debug, Trace, VmType, Userdata, PartialEq, Eq, PartialOrd, Ord)]
#[gluon(vm_type = "lancer.types.uint.prim.UInt")]
#[gluon_trace(skip)]
#[gluon_userdata(clone)]
pub struct UInt(pub BigUint);

impl Deref for UInt {
    type Target = BigUint;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl UInt {
    pub fn new(value: BigUint) -> Self {
        Self(value)
    }

    pub fn value(&self) -> BigUint {
        self.0.clone()
    }

    pub fn into_value(self) -> BigUint {
        self.0
    }
}

impl From<BigUint> for UInt {
    fn from(value: BigUint) -> Self {
        Self(value)
    }
}

impl From<UInt> for BigUint {
    fn from(value: UInt) -> Self {
        value.0
    }
}

impl From<u8> for UInt {
    fn from(value: u8) -> Self {
        UInt(BigUint::from(value))
    }
}

impl TryFrom<i8> for UInt {
    type Error = anyhow::Error;

    fn try_from(value: i8) -> Result<Self, Self::Error> {
        if value < 0 {
            bail!("Cannot convert negative i8 to UInt");
        }
        Ok(UInt(BigUint::from(value as u8)))
    }
}

impl From<u16> for UInt {
    fn from(value: u16) -> Self {
        UInt(BigUint::from(value))
    }
}

impl TryFrom<i16> for UInt {
    type Error = anyhow::Error;

    fn try_from(value: i16) -> Result<Self, Self::Error> {
        if value < 0 {
            bail!("Cannot convert negative i16 to UInt");
        }
        Ok(UInt(BigUint::from(value as u16)))
    }
}

impl From<u32> for UInt {
    fn from(value: u32) -> Self {
        UInt(BigUint::from(value))
    }
}

impl TryFrom<i32> for UInt {
    type Error = anyhow::Error;

    fn try_from(value: i32) -> Result<Self, Self::Error> {
        if value < 0 {
            bail!("Cannot convert negative i32 to UInt");
        }
        Ok(UInt(BigUint::from(value as u32)))
    }
}

impl From<u64> for UInt {
    fn from(value: u64) -> Self {
        UInt(BigUint::from(value))
    }
}

impl TryFrom<i64> for UInt {
    type Error = anyhow::Error;

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        if value < 0 {
            bail!("Cannot convert negative i64 to UInt");
        }
        Ok(UInt(BigUint::from(value as u64)))
    }
}

impl From<u128> for UInt {
    fn from(value: u128) -> Self {
        UInt(BigUint::from(value))
    }
}

impl TryFrom<i128> for UInt {
    type Error = anyhow::Error;

    fn try_from(value: i128) -> Result<Self, Self::Error> {
        if value < 0 {
            bail!("Cannot convert negative i128 to UInt");
        }
        Ok(UInt(BigUint::from(value as u128)))
    }
}

impl From<U256> for UInt {
    fn from(value: U256) -> Self {
        let bytes = value.to_le_bytes();
        UInt(BigUint::from_bytes_le(&bytes))
    }
}

impl TryFrom<UInt> for u64 {
    type Error = anyhow::Error;

    fn try_from(value: UInt) -> Result<Self, Self::Error> {
        value.0.to_u64().context("Value is too large for u64")
    }
}

impl TryFrom<UInt> for u128 {
    type Error = anyhow::Error;

    fn try_from(value: UInt) -> Result<Self, Self::Error> {
        value.0.to_u128().context("Value is too large for u64")
    }
}

impl TryFrom<UInt> for U256 {
    type Error = anyhow::Error;

    fn try_from(value: UInt) -> Result<Self, Self::Error> {
        let mut bytes = value.0.to_bytes_le();
        if bytes.len() > U256_NUM_BYTES {
            bail!("Value is too large for U256");
        }
        while bytes.len() < U256_NUM_BYTES {
            bytes.push(0);
        }
        Ok(U256::from_le_bytes(bytes.as_slice().try_into().unwrap()))
    }
}

impl FromStr for UInt {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        s.parse::<BigUint>().map(UInt).map_err(|e| e.to_string())
    }
}

impl Add for UInt {
    type Output = Self;
    fn add(self, rhs: Self) -> Self::Output {
        UInt(self.0 + rhs.0)
    }
}

impl Sub for UInt {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self::Output {
        UInt(self.0 - rhs.0)
    }
}

impl Mul for UInt {
    type Output = Self;
    fn mul(self, rhs: Self) -> Self::Output {
        UInt(self.0 * rhs.0)
    }
}

impl Div for UInt {
    type Output = Self;
    fn div(self, rhs: Self) -> Self::Output {
        UInt(self.0 / rhs.0)
    }
}

impl Rem for UInt {
    type Output = Self;
    fn rem(self, rhs: Self) -> Self::Output {
        UInt(self.0 % rhs.0)
    }
}

impl BitAnd for UInt {
    type Output = Self;
    fn bitand(self, rhs: Self) -> Self::Output {
        UInt(self.0 & rhs.0)
    }
}

impl BitOr for UInt {
    type Output = Self;
    fn bitor(self, rhs: Self) -> Self::Output {
        UInt(self.0 | rhs.0)
    }
}

impl BitXor for UInt {
    type Output = Self;
    fn bitxor(self, rhs: Self) -> Self::Output {
        UInt(self.0 ^ rhs.0)
    }
}

impl Shl<VmInt> for UInt {
    type Output = Self;
    fn shl(self, rhs: VmInt) -> Self::Output {
        UInt(self.0 << rhs as usize)
    }
}

impl Shr<VmInt> for UInt {
    type Output = Self;
    fn shr(self, rhs: VmInt) -> Self::Output {
        UInt(self.0 >> rhs as usize)
    }
}

/*
impl Not for UInt {
    type Output = Self;
    fn not(self) -> Self::Output {
        UInt(!self.0)
    }
}
*/

impl Pow<VmInt> for UInt {
    type Output = Self;

    fn pow(self, exp: VmInt) -> Self {
        UInt(self.0.pow(exp as usize))
    }
}

fn mask(bits: usize) -> UInt {
    if bits <= 0 {
        UInt(BigUint::zero())
    } else {
        UInt((BigUint::one() << bits) - BigUint::one())
    }
}

fn load(vm: &Thread) -> vm::Result<vm::ExternModule> {
    ExternModule::new(
        vm,
        record!(
            type UInt => UInt,
            from_str => primitive!(1, "lancer.types.uint.prim.from_str", UInt::from_str),
            from_str_radix => primitive!(2, "lancer.types.uint.prim.from_str_radix", |s: &str, radix: VmInt| {
                BigUint::parse_bytes(s.as_bytes(), radix as u32).map(UInt).ok_or(())
            }),

            min_value => UInt(BigUint::zero()),
            max_value => primitive!(1, "lancer.types.uint.prim.max_value", |bits: usize| mask(bits)),
            zero => UInt(BigUint::zero()),
            one => UInt(BigUint::one()),

            // Basic arithmetic
            add => primitive!(2, "lancer.types.uint.prim.add", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 + b.0),
            sub => primitive!(2, "lancer.types.uint.prim.sub", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 - b.0),
            mul => primitive!(2, "lancer.types.uint.prim.mul", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 * b.0),
            div => primitive!(2, "lancer.types.uint.prim.div", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 / b.0),
            rem => primitive!(2, "lancer.types.uint.prim.rem", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 % b.0),
            pow => primitive!(2, "lancer.types.uint.prim.pow", |a: UserdataValue<UInt>, b: VmInt| a.0.pow(b)),

            // Bitwise
            shl => primitive!(2, "lancer.types.uint.prim.shl", |a: UserdataValue<UInt>, b: VmInt| a.0 << b),
            shr => primitive!(2, "lancer.types.uint.prim.shr", |a: UserdataValue<UInt>, b: VmInt| a.0 >> b),
            bitand => primitive!(2, "lancer.types.uint.prim.bitand", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 & b.0),
            bitor  => primitive!(2, "lancer.types.uint.prim.bitor", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 | b.0),
            bitxor => primitive!(2, "lancer.types.uint.prim.bitxor", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 ^ b.0),

            // Extended math with bitwidth
            wrapping_add => primitive!(3, "lancer.types.uint.prim.wrapping_add", |a: UserdataValue<UInt>, b: UserdataValue<UInt>, bits: usize| {
                (a.0 + b.0) & mask(bits)
            }),
            /*
            wrapping_sub => primitive!(3, "lancer.types.uint.prim.wrapping_sub", |a: UserdataValue<UInt>, b: UserdataValue<UInt>, bits: usize| {
                ((a.0 + !b.0 & mask(bits)) + BigUint::one()) & mask(bits)
            }),
            */
            wrapping_mul => primitive!(3, "lancer.types.uint.prim.wrapping_mul", |a: UserdataValue<UInt>, b: UserdataValue<UInt>, bits: usize| {
                (a.0 * b.0) & mask(bits)
            }),

            overflowing_add => primitive!(3, "lancer.types.uint.prim.overflowing_add", |a: UserdataValue<UInt>, b: UserdataValue<UInt>, bits: usize| {
                let res = a.0 + b.0;
                let overflow = res.bits() > bits;
                (res & mask(bits), overflow)
            }),

            checked_add => primitive!(3, "lancer.types.uint.prim.checked_add", |a: UserdataValue<UInt>, b: UserdataValue<UInt>, bits: usize| {
                let res = a.0 + b.0;
                if res.bits() > bits {
                    None
                } else {
                    Some(res)
                }
            }),

            saturating_add => primitive!(3, "lancer.types.uint.prim.saturating_add", |a: UserdataValue<UInt>, b: UserdataValue<UInt>, bits: usize| {
                let res = a.0 + b.0;
                if res.bits() > bits {
                    mask(bits)
                } else {
                    res
                }
            }),

            from_int => primitive!(1, "lancer.types.uint.prim.from_int", |value: VmInt| UInt::try_from(value).map_err(|e| e.to_string())),
            to_int => primitive!(1, "lancer.types.uint.prim.to_int", |value: UserdataValue<UInt>| {
                value.0.to_i64().ok_or_else(|| "Value is too large for u64".to_string())
            }),
            show_uint => primitive!(1, "lancer.types.uint.prim.show_uint", |value: UserdataValue<UInt>| {
                value.0.to_string()
            }),
            eq => primitive!(2, "lancer.types.uint.prim.eq", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0 == b.0),
            cmp => primitive!(2, "lancer.types.uint.prim.cmp", |a: UserdataValue<UInt>, b: UserdataValue<UInt>| a.0.cmp(&b.0)),
        ),
    )
}

pub fn install(vm: &Thread) -> vm::Result<()> {
    vm.register_type::<UInt>("lancer.types.uint.prim.UInt", &[])?;

    add_extern_module(vm, "lancer.types.uint.prim", load);
    Ok(())
}
