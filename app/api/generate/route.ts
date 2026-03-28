import { NextRequest } from 'next/server';
import { analyzeIntent } from '@/lib/prompts/intentAnalysis';
import { findSerpGaps } from '@/lib/prompts/serpGapResearch';
import { projectTraffic } from '@/lib/prompts/trafficProjection';
import { createBrief } from '@/lib/prompts/generateBrief';
import { writeBlog } from '@/lib/prompts/writeBlog';
import { humanize } from '@/lib/prompts/humanize';
import { scoreSEO } from '@/lib/prompts/seoScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for the whole pipeline

const STAGES = [
  { id: 'intent', name: 'Intent Analysis & Keyword Clustering', icon: '🧠' },
  { id: 'serp', name: 'SERP Gap Research', icon: '🔍' },
  { id: 'traffic', name: 'Traffic Projection', icon: '📈' },
  { id: 'brief', name: 'Blog Brief Generation', icon: '📋' },
  { id: 'write', name: 'Blog Writing', icon: '✍️' },
  { id: 'humanize', name: 'Humanization Pass', icon: '🔄' },
  { id: 'score', name: 'SEO Validation', icon: '📊' },
];

export async function POST(req: NextRequest) {
  const { keyword } = await req.json();

  if (!keyword || !keyword.trim()) {
    return new Response(JSON.stringify({ error: 'Keyword is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const seedKeyword = keyword.trim();
  const startTime = Date.now();

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const sendSSE = async (event: string, data: any) => {
    try {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    } catch (err) {
      console.error("Failed to write to SSE stream", err);
      throw new Error("Stream closed");
    }
  };

  // Run the pipeline asynchronously so we can return the stream immediately
  (async () => {
    try {
      await sendSSE('init', {
        keyword: seedKeyword,
        stages: STAGES,
        startTime,
      });

      // Stage 1
      await sendSSE('stage-start', { stage: 'intent', index: 0 });
      const keywordData = await analyzeIntent(seedKeyword);
      await sendSSE('stage-complete', {
        stage: 'intent',
        index: 0,
        data: keywordData,
        duration: Date.now() - startTime,
      });

      // Stage 2
      await sendSSE('stage-start', { stage: 'serp', index: 1 });
      const gapData = await findSerpGaps(keywordData);
      await sendSSE('stage-complete', {
        stage: 'serp',
        index: 1,
        data: gapData,
        duration: Date.now() - startTime,
      });

      // Stage 3
      await sendSSE('stage-start', { stage: 'traffic', index: 2 });
      const trafficData = await projectTraffic(keywordData, gapData);
      await sendSSE('stage-complete', {
        stage: 'traffic',
        index: 2,
        data: trafficData,
        duration: Date.now() - startTime,
      });

      // Stage 4
      await sendSSE('stage-start', { stage: 'brief', index: 3 });
      const brief = await createBrief(keywordData, gapData, trafficData);
      await sendSSE('stage-complete', {
        stage: 'brief',
        index: 3,
        data: brief,
        duration: Date.now() - startTime,
      });

      // Stage 5-7 Loop
      let attempt = 1;
      const MAX_RETRIES = 3;
      let rawBlog = '';
      let humanizedBlog = '';
      let scorecard: any = null;

      while (attempt <= MAX_RETRIES) {
        // Stage 5
        await sendSSE('stage-start', { stage: 'write', index: 4 });
        rawBlog = await writeBlog(brief, keywordData);
        await sendSSE('stage-complete', {
          stage: 'write',
          index: 4,
          data: { preview: rawBlog.substring(0, 300) + '...' },
          duration: Date.now() - startTime,
        });

        // Stage 6
        await sendSSE('stage-start', { stage: 'humanize', index: 5 });
        humanizedBlog = await humanize(rawBlog);
        await sendSSE('stage-complete', {
          stage: 'humanize',
          index: 5,
          data: { preview: humanizedBlog.substring(0, 300) + '...' },
          duration: Date.now() - startTime,
        });

        // Stage 7
        await sendSSE('stage-start', { stage: 'score', index: 6 });
        scorecard = await scoreSEO(humanizedBlog, brief);
        await sendSSE('stage-complete', {
          stage: 'score',
          index: 6,
          data: scorecard,
          duration: Date.now() - startTime,
        });

        if (scorecard.publish_ready && scorecard.overall_score >= 75) {
          break;
        } else if (attempt < MAX_RETRIES) {
          await sendSSE('retry', { message: `Score too low (${scorecard.overall_score}). Regenerating...`, attempt });
          attempt++;
        } else {
          break;
        }
      }

      // Final Output
      await sendSSE('complete', {
        blog: humanizedBlog,
        scorecard,
        brief,
        keywordData,
        gapData,
        trafficData,
        totalDuration: Date.now() - startTime,
      });

    } catch (error: any) {
      console.error('Pipeline error:', error);
      if (error.message !== 'Stream closed') {
        try {
          await sendSSE('error', {
            message: error.message || 'An unexpected error occurred during generation',
            stage: 'unknown',
            duration: Date.now() - startTime,
          });
        } catch (e) {}
      }
    } finally {
      try {
        await writer.close();
      } catch (e) {
        // Stream might already be closed or aborted, which is fine
      }
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
