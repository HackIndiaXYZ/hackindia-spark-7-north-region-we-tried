const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  const session = await prisma.interviewSession.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  if (!session) return console.log('no session');
  
  const res = await fetch('http://localhost:3000/api/screening/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: session.id })
  });
  const text = await res.text();
  console.log('STATUS:', res.status);
  console.log('TEXT:', text);
}
test();
