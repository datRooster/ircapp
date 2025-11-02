import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE /api/messages/[id]
export async function DELETE(_req: Request, context: any) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const params = await context.params;
    const messageId = params.id;
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { channel: true }
    })
    if (!message) {
      return NextResponse.json({ error: 'Messaggio non trovato' }, { status: 404 })
    }
    // Solo admin o moderatore del canale può eliminare
    const isAdmin = user.roles.includes('admin')
    const isModerator = user.roles.includes('moderator')
    if (!isAdmin && !isModerator) {
      return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })
    }
    await prisma.message.delete({ where: { id: messageId } })
    return NextResponse.json({ ok: true, message: 'Messaggio eliminato' })
  } catch (error) {
    console.error('Errore eliminazione messaggio:', error)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
