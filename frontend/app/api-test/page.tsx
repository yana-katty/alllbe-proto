'use client';

import { trpc } from '@/lib/trpc';
import { Header } from '@/components/shared/header';
import { Footer } from '@/components/shared/footer';
import { LoadingSpinner } from '@/components/shared/loading';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export default function ApiTestPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  
  // Test queries
  const healthQuery = trpc.health.check.useQuery(undefined, {
    enabled: false, // Only run when manually triggered
  });
  
  const experienceByIdQuery = trpc.experience.getById.useQuery('yami-no-yakata-vr', {
    enabled: false,
  });
  
  const experienceListQuery = trpc.experience.list.useQuery(
    { limit: 3, status: 'published' },
    { enabled: false }
  );

  const bookingMutation = trpc.booking.create.useMutation();

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const runTests = async () => {
    setTestResults([]);
    
    // Test 1: Health check
    addResult('🔍 Testing health check...');
    try {
      await healthQuery.refetch();
      if (healthQuery.data) {
        addResult(`✅ Health check passed: ${healthQuery.data.message}`);
      }
    } catch (error) {
      addResult(`❌ Health check failed: ${error}`);
    }

    // Test 2: Get experience by ID
    addResult('🔍 Testing experience.getById...');
    try {
      await experienceByIdQuery.refetch();
      if (experienceByIdQuery.data) {
        addResult(`✅ Experience fetched: ${experienceByIdQuery.data.title}`);
      }
    } catch (error) {
      addResult(`❌ Get experience failed: ${error}`);
    }

    // Test 3: List experiences
    addResult('🔍 Testing experience.list...');
    try {
      await experienceListQuery.refetch();
      if (experienceListQuery.data) {
        addResult(`✅ Experiences listed: ${experienceListQuery.data.experiences.length} items`);
      }
    } catch (error) {
      addResult(`❌ List experiences failed: ${error}`);
    }

    // Test 4: Create booking
    addResult('🔍 Testing booking.create...');
    try {
      const result = await bookingMutation.mutateAsync({
        experienceId: 'yami-no-yakata-vr',
        numberOfParticipants: '2',
        scheduledVisitTime: new Date(Date.now() + 86400000).toISOString(),
      });
      addResult(`✅ Booking created: ${result.id}`);
    } catch (error) {
      addResult(`❌ Create booking failed: ${error}`);
    }

    addResult('✨ All tests completed!');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">Mock tRPC API Test</h1>
          <p className="text-gray-600">
            Phase 1 MVP: Mock サーバーを使った API 呼び出しのテスト
          </p>
        </div>

        <div className="bg-gray-50 p-8 rounded-lg mb-8">
          <h2 className="text-2xl font-bold mb-4">Available Endpoints</h2>
          <ul className="space-y-2 font-mono text-sm">
            <li>✅ GET /trpc/health.check</li>
            <li>✅ GET /trpc/experience.getById</li>
            <li>✅ GET /trpc/experience.list</li>
            <li>✅ GET /trpc/experience.listByBrand</li>
            <li>✅ POST /trpc/booking.create</li>
            <li>✅ GET /trpc/booking.listByUser</li>
          </ul>
        </div>

        <div className="mb-8">
          <Button 
            onClick={runTests} 
            size="lg"
            disabled={bookingMutation.isPending}
            className="w-full"
          >
            {bookingMutation.isPending ? (
              <>
                <LoadingSpinner />
                <span className="ml-2">Running Tests...</span>
              </>
            ) : (
              '🚀 Run API Tests'
            )}
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="bg-black text-green-400 p-6 rounded-lg font-mono text-sm">
            <h3 className="text-white font-bold mb-4">Test Results:</h3>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index}>{result}</div>
              ))}
            </div>
          </div>
        )}

        {experienceListQuery.data && experienceListQuery.data.experiences && (
          <div className="mt-8">
            <h3 className="text-2xl font-bold mb-4">Fetched Experiences:</h3>
            <div className="grid gap-4">
              {experienceListQuery.data.experiences.map((exp) => (
                <div key={exp.id} className="border p-4 rounded-lg">
                  <h4 className="font-bold">{exp.title}</h4>
                  <p className="text-sm text-gray-600">{exp.subtitle}</p>
                  <div className="mt-2 flex gap-4 text-sm">
                    <span>📍 {exp.location}</span>
                    <span>⏱️ {exp.duration}</span>
                    <span>💰 {exp.price}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
