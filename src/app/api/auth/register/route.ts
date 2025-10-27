import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json()

    // Validazione input
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username e password sono richiesti' },
        { status: 400 }
      )
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Username deve essere di almeno 3 caratteri' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password deve essere di almeno 6 caratteri' },
        { status: 400 }
      )
    }

    // Controlla se l'utente esiste già
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          ...(email ? [{ email: email }] : [])
        ]
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username o email già esistenti' },
        { status: 409 }
      )
    }

    // Hash della password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Crea nuovo utente nel database
    const newUser = await prisma.user.create({
      data: {
        username,
        email: email || null,
        password: hashedPassword,
        roles: ['user'],
        isOnline: false
      }
    })

    console.log(`✅ New user registered: ${username} (ID: ${newUser.id})`)

    return NextResponse.json({
      message: 'Utente registrato con successo',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        roles: newUser.roles
      }
    })

  } catch (error) {
    console.error('❌ Registration error:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}