import { createServerClient } from '../../../../lib/supabase-server';

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

    // Get signed URL before potentially deleting (valid 60s — enough to view)
    const { data: signed } = await supabase.storage
      .from('chat-media')
      .createSignedUrl(message.media_url, 60);

    if (newCount === 0) {
      // Delete from storage and clear media_url on message
      await supabase.storage.from('chat-media').remove([message.media_url]);
      await supabase
        .from('messages')
        .update({ views_remaining: 0, media_url: null })
        .eq('id', id);
    } else {
      await supabase
        .from('messages')
        .update({ views_remaining: newCount })
        .eq('id', id);
    }

    return Response.json({ url: signed?.signedUrl, viewsLeft: newCount });
  } catch (err) {
    console.error('View error:', err);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
}
