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

const blockDivRounding = "rounded-sm";

export function VerticalDivider({ height = "h-6", color = "border-rose-plum", margins = "mx-2" }) {
    return <div className={`border-l-4 ${blockDivRounding} ${color} ${height} ${margins}`} />;
}

export function BlockWithDivider({ children, color = "border-rose-plum", bgcolor = "bg-rose-water" }) {
    return (
        <div className={`flex flex-row items-stretch mt-1 ${bgcolor} ${blockDivRounding}`}>
            <VerticalDivider height="self-stretch" margins="pr-2" color={color} />
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
} 