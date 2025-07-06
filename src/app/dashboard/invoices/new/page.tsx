"use client";

import { ModernInvoiceForm } from "@/components/forms/ModernInvoiceForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Suspense, useState } from 'react';
import { ArrowLeft, FileText, Settings, Eye, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { cn } from "@/lib/utils";

const steps = [
  { id: 1, name: 'Basic Info', icon: FileText, description: 'Invoice details & client' },
  { id: 2, name: 'Items', icon: Sparkles, description: 'Products & services' },
  { id: 3, name: 'Review', icon: Eye, description: 'Preview & finalize' }
];

export default function NewInvoicePage() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/invoices">
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Invoices
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-300" />
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Create New Invoice</h1>
                <p className="text-sm text-slate-600">Design professional invoices in minutes</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                <Clock className="h-3 w-3 mr-1" />
                Auto-saved
              </Badge>
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Progress</h2>
                <p className="text-sm text-slate-600">Track your invoice creation</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-8">
            {steps.map((step, index) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const Icon = step.icon;
              
              return (
                <div key={step.id} className="flex items-center space-x-3">
                  <div className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isCompleted
                      ? "bg-green-600 text-white"
                      : isActive
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      isActive ? "text-blue-600" : isCompleted ? "text-green-600" : "text-slate-500"
                    )}>
                      {step.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {step.description}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      "w-16 h-0.5 mx-4",
                      isCompleted ? "bg-green-600" : "bg-slate-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <Suspense fallback={
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="text-slate-500">Loading invoice builder...</p>
                </div>
              </div>
            }>
              <ModernInvoiceForm onStepChange={setCurrentStep} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
