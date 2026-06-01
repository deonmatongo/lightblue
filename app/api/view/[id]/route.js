import { createServerClient } from '../../../../lib/supabase-server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request, { params }) {
  try {
    const supabase = createServerClient();
    const { id } = params;

    const { data: message, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !message) {
      return Response.json({ error: 'not found' }, { status: 404 });
    }

    if (!message.media_url || message.views_remaining <= 0) {
      return Response.json({ expired: true });
    }

    const newCount = message.views_remaining - 1;

    // Public URL — reliable, no expiry issues
    const url = `${SUPABASE_URL}/storage/v1/object/public/chat-media/${message.media_url}`;

    if (newCount === 0) {
      // Last view — delete from storage and clear media_url
      await supabase.storage.from('chat-media').remove([message.media_url]);
      await supabase.from('messages').update({ views_remaining: 0, media_url: null }).eq('id', id);
    } else {
      await supabase.from('messages').update({ views_remaining: newCount }).eq('id', id);
    }

    return Response.json({ url, viewsLeft: newCount });
  } catch (err) {
    console.error('View route error:', err);
    return Response.json({ error: 'server error' }, { status: 500 });
  }
}
