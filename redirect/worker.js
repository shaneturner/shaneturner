export default {
  fetch(request) {
    const url = new URL(request.url)
    url.hostname = 'shaneturner.dev'
    return Response.redirect(url.toString(), 301)
  }
}
