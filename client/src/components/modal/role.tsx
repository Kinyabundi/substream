'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, User, ArrowRight, CheckCircle2, Wallet, Loader2 } from "lucide-react";
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { contractABI, ContractAddress } from '@/constants/abi';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FormData = {
    role: 'buyer' | 'merchant' | null;
};

interface RoleSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    address: string;
}

const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({ isOpen, onClose, address }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const formMethods = useForm<FormData>();
    const { watch, setValue } = formMethods;
    const selectedRole = watch('role');
    const { user } = useAuth();
    
    const { writeContract, data: hash, error: writeError } = useWriteContract();
    
    const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
        hash,
    });

    // Monitor transaction success
    React.useEffect(() => {
        if (isSuccess) {
            toast.success('Account created successfully!');
            // Redirect based on role
            if (selectedRole === 'merchant') {
                router.push('/app/merchant-dashboard');
            } else {
                router.push('/app/buyer-dashboard');
            }
            onClose();
        }
    }, [isSuccess, selectedRole, router, onClose]);

    // Monitor transaction error
    React.useEffect(() => {
        if (writeError) {
            toast.error(writeError.message || 'Failed to create account');
            setIsLoading(false);
        }
    }, [writeError]);

    const handleRoleSelect = (role: 'buyer' | 'merchant') => {
        setValue('role', role);
    };

    const roleMapping = {
        buyer: 1,
        merchant: 2,
    };

    const createUserAccount = async () => {
        if (!user?.isConnected) {
            toast.error('Please connect your wallet to create an account');
            return;
        }

        if (!selectedRole) {
            toast.error('Please select an account type');
            return;
        }

        setIsLoading(true);
        
        try {
            const numericRole = roleMapping[selectedRole];
            
            writeContract({
                abi: contractABI,
                address: ContractAddress,
                functionName: 'registerUser',
                args: [numericRole],
            });

        } catch (error) {
            console.error('Error creating account:', error);
            toast.error('Failed to create account. Please try again.');
            setIsLoading(false);
        }
    };

    const roles = [
        {
            id: 'buyer',
            title: 'Buyer Account',
            description: 'Subscribe to products and services',
            icon: <User className="h-6 w-6" />,
            features: [
                'Access to subscription products',
                'Automatic renewals',
                'Payment history',
                'Subscription management'
            ]
        },
        {
            id: 'merchant',
            title: 'Merchant Account',
            description: 'Create and manage subscription products',
            icon: <Building2 className="h-6 w-6" />,
            features: [
                'Create subscription products',
                'Revenue analytics',
                'Customer management',
                'Payment processing'
            ]
        }
    ];

    if (!user?.isConnected) {
        return (
            <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-lg text-center">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Connect Your Wallet</h2>
                <p className="text-gray-600 mb-6">
                    Please connect your wallet to create a SubStream account.
                </p>
                <Button
                    onClick={() => router.push('/')}
                    className="w-full"
                >
                    Return to Home
                </Button>
            </div>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Choose Your Account Type</DialogTitle>
                    <DialogDescription>
                        Select how you want to use SubStream. This cannot be changed later.
                    </DialogDescription>
                </DialogHeader>

                <FormProvider {...formMethods}>
                    <form onSubmit={(e) => e.preventDefault()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {roles.map((role) => (
                                <Card
                                    key={role.id}
                                    className={`relative p-4 cursor-pointer transition-all hover:border-primary 
                                        ${selectedRole === role.id ? 'border-2 border-primary' : 'border'}`}
                                    onClick={() => handleRoleSelect(role.id as 'buyer' | 'merchant')}
                                >
                                    {selectedRole === role.id && (
                                        <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-primary" />
                                    )}
                                    <div className="flex flex-col h-full">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="p-2 bg-primary/10 rounded-lg">
                                                {role.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold">{role.title}</h3>
                                                <p className="text-sm text-gray-500">
                                                    {role.description}
                                                </p>
                                            </div>
                                        </div>
                                        <ul className="space-y-2 text-sm text-gray-600">
                                            {role.features.map((feature, index) => (
                                                <li key={index} className="flex items-center gap-2">
                                                    <ArrowRight className="h-4 w-4 text-primary" />
                                                    {feature}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card>
                            ))}
                        </div>

                        <Button
                            onClick={createUserAccount}
                            disabled={isLoading || isConfirming || !selectedRole}
                            className="w-full"
                        >
                            {isLoading || isConfirming ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {isConfirming ? 'Confirming...' : 'Creating Account...'}
                                </>
                            ) : (
                                'Create Account'
                            )}
                        </Button>
                    </form>
                </FormProvider>
            </DialogContent>
        </Dialog>
    );
};

export default RoleSelectionModal;