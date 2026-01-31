"use client";
import React from "react";
import { Avatar } from "@/components/ui/Avatar";

export function Sidebar() {
    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="sidebar">
                <div className="logo-bubble">
                    <span className="material-symbols-outlined text-white">chat</span>
                </div>
                <div className="side-icons">
                    <div className="side-icon" title="Home">
                        <span className="material-symbols-outlined">home</span>
                    </div>
                    <div className="side-icon active" title="Messages">
                        <span className="material-symbols-outlined">chat_bubble</span>
                    </div>
                    <div className="side-icon" title="Notes">
                        <span className="material-symbols-outlined">edit</span>
                    </div>
                    <div className="side-icon" title="Files">
                        <span className="material-symbols-outlined">folder</span>
                    </div>
                    <div className="side-icon" title="Media">
                        <span className="material-symbols-outlined">image</span>
                    </div>
                </div>

                <div className="sidebar-footer">
                    <div className="side-icon side-icon-outline" title="Shortcuts">
                        <span className="material-symbols-outlined">auto_awesome</span>
                    </div>
                    <Avatar name="You" src="/avatars/person.png" className="sidebar-avatar" />
                </div>
            </aside>
        </>
    );
}
