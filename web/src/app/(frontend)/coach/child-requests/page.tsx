import { redirect } from 'next/navigation'

// Экран слился с общим инбоксом заявок (/coach/requests): взрослые и дети в одном
// месте, включая зависшие parent_review. Старый URL оставлен редиректом — на него
// ссылались /coach/staff и закладки.
const Page = () => redirect('/coach/requests')
export default Page
