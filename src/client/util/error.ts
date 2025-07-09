import { UserError } from '../../common/error'

export function showError(e: any) {
  if (e instanceof UserError) {
    alert(e.errmsg)
  } else {
    alert('Something went wrong. Please refresh page and try again.')
  }
}
