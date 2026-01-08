import { useState } from "react";

import CloseIcon from "../assets/close.svg?react";
import MenuIcon from "../assets/menu.svg?react";

export default function Sidebar({ items }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div
            className={`flex flex-col bg-rose-water text-rose-plum h-screen transition-all duration-300
      ${collapsed ? "w-16" : "w-64"}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4">
                {!collapsed && <h2 className="text-lg main-header">Menu</h2>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-rose-plum hover:text-rose-copper hover:bg-dark/30 rounded focus:outline-none"
                >
                    {collapsed ? (
                        <MenuIcon className="w-6 h-6" />
                    ) : (
                        // <img src={menuIconUrl} alt="Menu" className="w-6 h-6 text-rose-plum" />
                        <CloseIcon className="w-6 h-6" />
                        // <img src={closeIconUrl} alt="Close" className="w-6 h-6" />
                    )}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 mt-4">
                {items.map((item) => (
                    <a
                        key={item.name}
                        href={item.href}
                        className="flex items-center py-2 px-4 hover:bg-dark/30 rounded"
                    >
                        {item.icon && <span className="mr-2">{item.icon}</span>}
                        {!collapsed && <span>{item.name}</span>}
                    </a>
                ))}
            </nav>
        </div>
    );
}
