import { Ban, Building2, Check, ChevronDown, Plus, Settings } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useOrganization } from '../contexts/organization-context';
import type { Organization } from '../lib/api';

export function OrganizationSwitcher() {
    const { currentOrganization, organizations, switchOrganization, isLoading } = useOrganization();
    const [isOpen, setIsOpen] = useState(false);

    if (isLoading) {
        return <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-100" aria-label="Loading organizations" />;
    }

    if (!organizations || organizations.length === 0) {
        return (
            <Link to="/organizations/create" className="btn btn-primary btn-sm">
                <Plus /> Create organization
            </Link>
        );
    }

    if (!currentOrganization) return null;

    const handleSwitch = (org: Organization) => {
        if (org.isActive === false) {
            toast.error('This organization has been deactivated');
            return;
        }
        switchOrganization(org.id);
        setIsOpen(false);
    };

    const inactive = currentOrganization.isActive === false;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`inline-flex h-8 max-w-[13rem] items-center gap-2 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors ${inactive ? 'bg-gray-100 text-gray-400' : 'text-gray-700 hover:bg-gray-100'}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                title={currentOrganization.name}
            >
                <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="truncate">{currentOrganization.name}</span>
                {inactive && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">Inactive</span>}
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg" role="menu">
                        <p className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Organizations</p>
                        <div className="max-h-64 overflow-y-auto px-1.5 pb-1.5">
                            {organizations.map((org) => {
                                const isCurrent = org.id === currentOrganization.id;
                                const isInactive = org.isActive === false;
                                return (
                                    <button
                                        key={org.id}
                                        onClick={() => handleSwitch(org)}
                                        disabled={isInactive}
                                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${isInactive ? 'cursor-not-allowed text-gray-400' : isCurrent ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                                        role="menuitem"
                                    >
                                        {isInactive ? <Ban className="h-3.5 w-3.5 shrink-0" /> : <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />}
                                        <span className="flex-1 truncate">{org.name}</span>
                                        {isCurrent && <Check className="h-4 w-4 shrink-0" />}
                                        {isInactive && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">Inactive</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="border-t border-gray-100 p-1.5">
                            <Link
                                to="/organizations/$organizationId/settings"
                                params={{ organizationId: currentOrganization.id }}
                                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                onClick={() => setIsOpen(false)}
                                role="menuitem"
                            >
                                <Settings className="h-3.5 w-3.5" /> Organization settings
                            </Link>
                            <Link
                                to="/organizations/create"
                                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-blue-700 hover:bg-blue-50"
                                onClick={() => setIsOpen(false)}
                                role="menuitem"
                            >
                                <Plus className="h-3.5 w-3.5" /> Create organization
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
