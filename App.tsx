import React, { useState } from 'react';
import { SearchParams, Business, WorkflowStep, ProcessingLog } from './types';
import { searchBusinesses, fetchLocationSuggestions, fetchCategorySuggestions } from './services/mapsService';
import { LogViewer } from './components/LogViewer';
import { ResultsTable } from './components/ResultsTable';
import { AutocompleteInput } from './components/AutocompleteInput';
import { exportToCSV } from './utils/export';

const COMMON_CATEGORIES = [
  "Restaurant", "Cafe", "Coffee Shop", "Bakery", "Bar", "Pub", 
  "Gym", "Yoga Studio", "Salon", "Barbershop", "Spa", 
  "Dentist", "Plumber", "Electrician", "Mechanic", "HVAC",
  "Real Estate Agency", "Lawyer", "Accountant", "Marketing Agency",
  "Florist", "Bookstore", "Clothing Store", "Pet Store", "Veterinarian",
  "Daycare", "School", "Hotel", "Grocery Store", "Pharmacy"
];

const App: React.FC = () => {
  const [params, setParams] = useState<SearchParams>({
    location: '',
    category: '',
    // Google Maps usually returns up to ~60 results per search
    limit: 60
  });
  
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>(WorkflowStep.IDLE);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params.location || !params.category) return;

    setWorkflowStep(WorkflowStep.SEARCHING_MAPS);
    setLogs([]); // Clear previous logs
    setBusinesses([]);
    
    addLog("Starting new scout workflow...", "action");
    addLog(`Target: up to ${params.limit} ${params.category} businesses in ${params.location}. (Google limit)`, "info");

    try {
      const results = await searchBusinesses(
        params.location, 
        params.category, 
        params.limit,
        (msg) => addLog(msg, "info")
      );

      setBusinesses(results);

      addLog(`Workflow completed successfully.`, "success");
      addLog(`Summary: found ${results.length} businesses.`, "success");
      setWorkflowStep(WorkflowStep.COMPLETED);

    } catch (error) {
      addLog(`Workflow failed: ${error instanceof Error ? error.message : "Unknown error"}`, "action");
      setWorkflowStep(WorkflowStep.ERROR);
    }
  };

  const isProcessing = workflowStep === WorkflowStep.SEARCHING_MAPS || workflowStep === WorkflowStep.ANALYZING_RESULTS;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              AI
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800">LocalBizHunt</h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            Powered by Google Maps Places API
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Intro / Instruction */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold mb-2">Configure Workflow</h2>
          <p className="text-slate-500 mb-6 text-sm">
            <span className="text-xs text-slate-400">Note: Google Maps returns up to about 60 results per search.</span>
          </p>
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="col-span-1 md:col-span-2">
              <div className="w-full">
                <AutocompleteInput
                  label="Location (City, Area)"
                  value={params.location}
                  onChange={(val) => setParams(prev => ({ ...prev, location: val }))}
                  placeholder="Enter area (e.g. Karama, Deira, Business Bay)"
                  disabled={isProcessing}
                  fetchSuggestions={fetchLocationSuggestions}
                />
              </div>
            </div>
            <div>
              <AutocompleteInput
                label="Business Category"
                value={params.category}
                onChange={(val) => setParams(prev => ({ ...prev, category: val }))}
                placeholder="Enter business type (e.g. Restaurant, Real Estate)"
                disabled={isProcessing}
                staticSuggestions={COMMON_CATEGORIES}
                fetchSuggestions={fetchCategorySuggestions}
              />
            </div>
            <div className="md:col-span-4 mt-2">
               <button
                type="submit"
                disabled={
                  isProcessing ||
                  !params.location ||
                  !params.category
                }
                className={`w-full md:w-auto px-6 py-2.5 rounded-md text-white font-medium shadow-sm transition-all flex items-center justify-center gap-2
                  ${isProcessing 
                    ? 'bg-slate-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}`}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Running Workflow...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    Start Research
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Workflow Logs */}
        <LogViewer logs={logs} />

        {/* Results Area */}
        {businesses.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
              <div className="text-sm text-slate-700 font-medium">
                Results: <span className="font-semibold">{businesses.length}</span> businesses
              </div>

              <button
                onClick={() => exportToCSV(businesses)}
                className="text-sm flex items-center gap-2 text-slate-600 hover:text-blue-600 border border-slate-300 bg-white px-3 py-1.5 rounded-md hover:border-blue-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Export CSV
              </button>
            </div>

            <div className="p-0">
              <ResultsTable businesses={businesses} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;