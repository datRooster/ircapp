export interface IRCMessage {
  prefix?: string
  command: string
  params: string[]
  raw: string
}

export class IRCMessageParser {
  static parse(line: string): IRCMessage {
    let prefix: string | undefined
    let command: string
    let params: string[] = []
    
    let remaining = line.trim()
    
    // Parse prefix se presente
    if (remaining.startsWith(':')) {
      const spaceIndex = remaining.indexOf(' ')
      if (spaceIndex !== -1) {
        prefix = remaining.substring(1, spaceIndex)
        remaining = remaining.substring(spaceIndex + 1)
      } else {
        prefix = remaining.substring(1)
        remaining = ''
      }
    }
    
    // Parse command
    const parts = remaining.split(' ')
    command = parts[0] || ''
    
    // Parse parameters
    let paramStart = 1
    for (let i = paramStart; i < parts.length; i++) {
      if (parts[i].startsWith(':')) {
        // Trailing parameter - tutto il resto
        params.push(parts.slice(i).join(' ').substring(1))
        break
      } else {
        params.push(parts[i])
      }
    }
    
    return {
      prefix,
      command: command.toUpperCase(),
      params,
      raw: line
    }
  }
  
  static format(command: string, params: string[] = [], prefix?: string): string {
    let message = ''
    
    if (prefix) {
      message += `:${prefix} `
    }
    
    message += command
    
    if (params.length > 0) {
      // Tutti i parametri tranne l'ultimo
      for (let i = 0; i < params.length - 1; i++) {
        message += ` ${params[i]}`
      }
      
      // Ultimo parametro con ':' se contiene spazi
      const lastParam = params[params.length - 1]
      if (lastParam.includes(' ') || lastParam.startsWith(':')) {
        message += ` :${lastParam}`
      } else {
        message += ` ${lastParam}`
      }
    }
    
    return message
  }
}