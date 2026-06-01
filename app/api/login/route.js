const USERS = {
  vanilla: 'nyash',
  red: '123456',
};

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const key = username?.toLowerCase().trim();
    if (!key || !password || USERS[key] !== password) {
      return Response.json({ error: 'wrong username or password' }, { status: 401 });
    }
    return Response.json({ username: key });
  } catch {
    return Response.json({ error: 'bad request' }, { status: 400 });
  }
}
