import { aiConfiguration } from '@/lib/ai/openrouter.server';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(aiConfiguration(), { headers: { 'Cache-Control': 'no-store' } });
}
