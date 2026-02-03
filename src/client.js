import { createClient } from '@supabase/supabase-js'

const URL = 'https://qlccomahzlrzazerghiw.supabase.co'
const API_KEY = "sb_publishable_45fNc5v46Cld8mXz21pHxw_5B3KBPq_"

export const supabase = createClient(URL, API_KEY)
