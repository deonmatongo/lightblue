import { createServerClient } from '../../../lib/supabase-server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const sender = formData.get('sender');

    if (!file || !sender) {
      return Response.json({ error: 'missing file or sender' }, { status: 400 });
    }

    if (file.size > 4 * 1024 * 1024) {
      return Response.json({ error: 'image must be under 4MB' }, { status: 400 });
    }

    const supabase = createServerClient();
    const ext = (file.name || 'image').split('.').pop().toLowerCase() || 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return Response.json({ error: 'upload failed: ' + uploadError.message }, { status: 500 });
    }

    // Public URL — no expiry, no signed token needed
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/chat-media/${path}`;

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({ sender, content: '', type: 'image', media_url: path, views_remaining: 2 })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return Response.json({ error: 'db insert failed' }, { status: 500 });
    }

    return Response.json({ message: { ...message, publicUrl } });
  } catch (err) {
    console.error('Upload route error:', err);
    return Response.json({ error: 'server error' }, { status: 500 });
  }
}
