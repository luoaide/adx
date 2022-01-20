import { Request } from "express"
import * as ucan from "ucans"
import { Chained, isCapabilityEscalation, Ucan } from "ucans"
import { twitterCapabilities }from './twitter-capability'


type Check = (ucan: Chained) => Error | null

export const checkUcan = async (req: Request, ...checks: Check[]): Promise<Chained> => {
  const header = req.headers.authorization
  if (!header) {
    throw new Error("No Ucan found in message headers")
  }

  const stripped = header.replace('Bearer ', '')
  const decoded = await ucan.Chained.fromToken(stripped)

  for(let i=0; i<checks.length; i++) {
    const maybeErr = checks[i](decoded)
    if (maybeErr !== null) {
      throw maybeErr
    }
  }

  return decoded
}

export const hasAudience = (did: string) => (token: Chained): Error | null => {
  if(token.audience() !== did) {
    return new Error("Ucan audience does not match server Did")
  }
  return null
}

export const hasPostingPermission = (username: string, rootDid: string) => (token: Chained): Error | null => {
  for(const cap of twitterCapabilities(token)) {
    // has a properly formatted capability for posting to user's twitter account
    if(!isCapabilityEscalation(cap) && cap.capability.twitter === username && cap.capability.cap === 'POST') {
      if(cap.info.originator !== rootDid) {
        return new Error(`Posting permission does not come from the user's root DID: ${rootDid}`)
      } else if (cap.info.expiresAt < Date.now() / 1000) {
        return new Error(`Ucan is expired`)
      } else if (cap.info.notBefore && cap.info.notBefore > Date.now() / 1000) {
        return new Error(`Ucan is being used before it's "not before" time`)
      } else {
        return null
      }
    }
  }
  return new Error(`Ucan does not permission the ability to post for user: ${username}`)
}

