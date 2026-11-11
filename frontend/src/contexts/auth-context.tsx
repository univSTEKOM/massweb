import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, LoginRequest, RegisterRequest } from '../lib/api';
import { authApi } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (data: LoginRequest) => Promise<void>;
    register: (data: RegisterRequest) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const queryClient = useQueryClient();

    useEffect(() => {
        // Check if user is logged in on mount
        const token = localStorage.getItem('auth_token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
            try {
                setUser(JSON.parse(savedUser));
                // Optionally verify token with backend
                authApi.me()
                    .then((response) => {
                        setUser(response.data);
                        localStorage.setItem('user', JSON.stringify(response.data));
                    })
                    .catch(() => {
                        // Token invalid, clear auth
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('user');
                        localStorage.removeItem('current_organization_id');
                        setUser(null);
                        queryClient.clear();
                    })
                    .finally(() => setIsLoading(false));
            } catch {
                setIsLoading(false);
            }
        } else {
            setIsLoading(false);
        }
    }, [queryClient]);

    const login = async (data: LoginRequest) => {
        try {
            const response = await authApi.login(data);
            const { user, token } = response.data;

            localStorage.setItem('auth_token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);

            // Clear all cached queries and refetch
            queryClient.clear();

            toast.success('Welcome back!');
        } catch (error: any) {
            // The login form shows the error inline
            throw error;
        }
    };

    const register = async (data: RegisterRequest) => {
        try {
            const response = await authApi.register(data);
            const { user, token, organization } = response.data;

            localStorage.setItem('auth_token', token);
            localStorage.setItem('user', JSON.stringify(user));
            setUser(user);

            // Clear all cached queries
            queryClient.clear();

            if (organization) {
                toast.success(`Welcome! Organization "${organization.name}" created.`);
            } else {
                toast.success('Account created successfully!');
            }
        } catch (error: any) {
            // The register form shows the error inline
            throw error;
        }
    };

    const logout = () => {
        authApi.logout();
        setUser(null);
        localStorage.removeItem('current_organization_id');

        // Clear all cached queries
        queryClient.clear();

        toast.success('Logged out successfully');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
