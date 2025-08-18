import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

export async function handler(event, context) {
  if (event.httpMethod === 'GET') {
    // fetch posts
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { statusCode: 500, body: JSON.stringify(error) }
    return { statusCode: 200, body: JSON.stringify(data) }
  }

  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body)
    const secret = body.secret
    if (secret !== process.env.POST_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' }
    }

    const { type, content, images } = body
    const { data, error } = await supabase.from('posts').insert([
      { type, content, images }
    ])
    if (error) return { statusCode: 500, body: JSON.stringify(error) }
    return { statusCode: 200, body: JSON.stringify(data) }
  }

  return { statusCode: 405, body: 'Method Not Allowed' }
}
