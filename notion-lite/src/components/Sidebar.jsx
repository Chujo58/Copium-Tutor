import { useEffect, useState } from "react";
import { API_URL } from "../config";

import { CopperDivider } from "./Divider";

import {
    CircleChevronRight,
    CircleChevronLeft,
    LayoutDashboard,
    Pin,
    PinOff,
    HeartHandshake,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function SidebarItem({ href, icon: Icon, name, color, collapsed }) {
    return (
        <a
            href={href}
            className={`flex items-center hover:bg-dark/30 ${
                collapsed
                    ? "justify-center p-2 rounded-3xl hover:text-rose-copper"
                    : "w-60 rounded ml-2 mr-2 p-2"
            }`}
        >
            {Icon && (
                <Icon
                    className={`${!collapsed ? "mr-2" : ""}`} color={color}
                />
            )}
            {!collapsed && <span>{name}</span>}
        </a>
    );
}

export default function Sidebar({ projectsList, featureLinks, toolLinks }) {
    const [collapsed, setCollapsed] = useState(false);
    const [pinned, setPinned] = useState(true);
    const [openProfilePopout, setOpenProfilePopout] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [pfp, setPfp] = useState("");

    const { user, login, logout } = useAuth();
    const partnerLinks = [
        {
            href: "/backboard",
            icon: HeartHandshake,
            name: "Backboard.io",
            color: "#754B4D",
        },
    ];
    const mergedFeatureLinks = [
        ...(Array.isArray(featureLinks) ? featureLinks : []),
        ...partnerLinks,
    ];

    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_URL}/me`, {
                credentials: "include",
            });
            const data = await response.json();
            if (data.success) {
                setFirstName(data.user.fname);
                setLastName(data.user.lname);
                setPfp(data.user.pfp);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        }
    }

    useEffect(() => {
        fetchUserProfile();

        try {
            const stored = localStorage.getItem("sidebarPinned");
            if (stored !== null) {
                const p = stored === "true";
                setPinned(p);
                if (!p) setCollapsed(true);
            }
        } catch (err) {
            // ignore localStorage errors
        }
    }, []);

    return (
        <div
            className={`flex flex-col bg-rose-water text-rose-plum h-screen transition-all duration-300
      ${collapsed ? "w-16" : "w-64"}`}
            onMouseEnter={() => !pinned && setCollapsed(false)}
            onMouseLeave={() => !pinned && setCollapsed(true)}
        >
            <nav
                className={`flex flex-col h-full ${
                    collapsed ? "items-center justify-between" : ""
                }`}
            >
                {/* HEADER */}
                <div
                    className={`items-center justify-between ${
                        collapsed ? "p-2" : "p-4 flex"
                    }`}
                >
                    {!collapsed && (
                        <h2 className="text-xl font-card main-header">Menu</h2>
                    )}
                    <button
                        onClick={() => {
                            const next = !pinned;
                            setPinned(next);
                            try {
                                localStorage.setItem("sidebarPinned", String(next));
                            } catch (err) {
                                // ignore localStorage errors
                            }
                            if (!next) setCollapsed(true);
                        }}
                        className="text-rose-plum hover:text-rose-copper hover:bg-dark/30 rounded-3xl focus:outline-none p-2"
                    >
                        {pinned ? <PinOff /> : <Pin />}
                    </button>
                    {/* Divider */}
                    {collapsed && <CopperDivider margins="mt-2" />}
                </div>
                <SidebarItem
                    key="dashboard"
                    href="/dashboard"
                    collapsed={collapsed}
                    icon={LayoutDashboard}
                    name="Dashboard"
                    color="#754B4D"
                />
                {mergedFeatureLinks.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between p-2 mx-2">
                            {!collapsed && (
                                <div className="flex flex-col w-full">
                                    <h2 className="main-header font-card">Features</h2>
                                    <CopperDivider />
                                </div>
                            )}
                        </div>
                        {mergedFeatureLinks.map((item) => (
                            <SidebarItem
                                key={item.name || item.href}
                                href={item.href}
                                icon={item.icon}
                                name={item.name}
                                collapsed={collapsed}
                                color={item.color}
                            />
                        ))}
                    </>
                ) : null}
                {Array.isArray(toolLinks) && toolLinks.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between p-2 mx-2">
                            {!collapsed && (
                                <div className="flex flex-col w-full">
                                    <h2 className="main-header font-card">Study Tools</h2>
                                    <CopperDivider />
                                </div>
                            )}
                        </div>
                        {toolLinks.map((item) => (
                            <SidebarItem
                                key={item.name || item.href}
                                href={item.href}
                                icon={item.icon}
                                name={item.name}
                                collapsed={collapsed}
                                color={item.color}
                            />
                        ))}
                    </>
                ) : null}
                {/* Add a list of all the projects */}
                <div className="flex items-center justify-between p-2 mx-2">
                    {!collapsed && (
                        <div className="flex flex-col w-full">
                            <h2 className="main-header font-card">Projects</h2>
                            <CopperDivider />
                        </div>
                    )}
                </div>
                {Array.isArray(projectsList) && projectsList.length > 0
                    ? projectsList.map((item) => (
                          <SidebarItem
                              //   key={item.name}
                              href={item.href}
                              icon={item.icon}
                              name={item.name}
                              collapsed={collapsed}
                              color={item.color}
                          />
                      ))
                    : ""}
                {/* Now at the bottom, we should have the user profile */}
                <div className="mt-auto flex p-4 bg-rose-dusty/40">
                    {/* The popup that shows user options comes here which is inline of the sidebar*/}
                    {openProfilePopout && !collapsed && (
                        <div
                            className="absolute bottom-16 left-4 bg-rose-dusty/40 rounded p-4 w-48 z-10 border-2 border-rose-dusty/60 font-card"
                            onMouseLeave={() => setOpenProfilePopout(false)}
                        >
                            <a
                                href="/profile"
                                className="block px-4 py-2 hover:bg-dark/30 rounded"
                            >
                                View Profile
                            </a>
                            <a
                                href="/settings"
                                className="block px-4 py-2 hover:bg-dark/30 rounded"
                            >
                                Settings
                            </a>
                            <button
                                onClick={() => {
                                    // Log the user out by calling the logout API
                                    logout();
                                    // Redirect to home page after a sleep timeout
                                    setTimeout(() => {
                                        window.location.href = "/";
                                    }, 500);
                                }}
                                className="block px-4 py-2 hover:bg-dark/30 rounded text-red-500"
                            >
                                Logout
                            </button>
                        </div>
                    )}
                    {/* Circle profile picture */}
                    <div
                        onClick={() => setOpenProfilePopout(!openProfilePopout)}
                        className="flex items-center cursor-pointer"
                    >
                        <img
                            src={pfp}
                            alt={`${firstName.charAt(0)} ${lastName.charAt(0)}`}
                            className="rounded-full w-8 h-8 text-sm bg-dark text-accent text-center flex items-center justify-center main-header"
                        />
                        {!collapsed && (
                            <div className="text-center flex items-center justify-center ml-4 font-card">
                                {`${firstName} ${lastName}`}
                            </div>
                        )}
                    </div>
                </div>
            </nav>
        </div>
    );
}
