'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuickPredict } from './quick-predict'
import { PredictionHistory } from './prediction-history'
import { ModelPerformance } from './model-performance'
import { PatchAnalyzerUI } from './patch-analyzer-ui'

export function ModelDashboard() {
  const [subTab, setSubTab] = useState('predict')

  return (
    <div className="space-y-6">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="predict">Quick Predict</TabsTrigger>
          <TabsTrigger value="history">Predictions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="patch">Patch Analyzer</TabsTrigger>
        </TabsList>

        <TabsContent value="predict" className="space-y-6 mt-4">
          <QuickPredict />
        </TabsContent>

        <TabsContent value="history" className="space-y-6 mt-4">
          <PredictionHistory />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-4">
          <ModelPerformance />
        </TabsContent>

        <TabsContent value="patch" className="space-y-6 mt-4">
          <PatchAnalyzerUI />
        </TabsContent>
      </Tabs>
    </div>
  )
}
