export default function Divider( {color, margins} ) {
    return <hr className={`border-t-2 ${color} ${margins}`} />;
}

export function CopperDivider({ margins }) {
    return <Divider color="border-rose-copper" margins={margins} />;
}

export function PlumDivider({ margins }) {
    return <Divider color="border-rose-plum" margins={margins} />;
}

export function WaterDivider({ margins }) {
    return <Divider color="border-rose-water" margins={margins} />;
}

export function DustyDivider({ margins }) {
    return <Divider color="border-rose-dusty" margins={margins} />;
}

export function ChinaDivider({ margins }) {
    return <Divider color="border-rose-china" margins={margins} />;
}