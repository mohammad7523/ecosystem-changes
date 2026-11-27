/* إعداد الخدمة الخلفية. تملؤه أداة tools/configure-backend.mjs، وهي تضبط أيضًا سياسة CSP في الصفحات.
   supabaseUrl فارغ = الحسابات معطّلة، والموقع يعمل كما في 10.6 دون أي اتصال بخادم.
   المفتاح anon عام بطبيعته (يُرسل من المتصفح)، والحماية في سياسات قاعدة البيانات؛ لا يوضع هنا مفتاح service_role أبدًا. */
window.ECO_CONFIG = {
  supabaseUrl: 'https://pzpaltrdcntqipvvqsbl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6cGFsdHJkY250cWlwdnZxc2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU2NzAxNzEsImV4cCI6MjExMTI0NjE3MX0.Y7-fK_hOuMffUpzBU0ck0DS7bCZJDAeseBxp-b9GtTQ',
  usernameDomain: 'users.eco-lesson.invalid', // بريد شكلي داخلي من اسم المستخدم؛ لا بريد حقيقي ولا رسائل
  supportEmail: 'mohammad7523@gmail.com',
  supportEmailConfirmed: true,                // اعتمده مالكه للنشر في تكليف 11.1
  supportEnglishConfirmed: false,             // يصير true حين يؤكد المالك أنه يرد على الرسائل بالإنجليزية (المؤشر 9.1.3)
};
