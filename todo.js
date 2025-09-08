export default {
    name: "Sourcehut todo GraphQL Wrapper",
    tags: [""],
};

export async function get_srht_todo(env, query) {
    const bearer_token = env.SOURCEHUT_TODO_TOKEN;

    const graphqlQuery = {
        query: `query {
    me {
      tracker(name: "general") {
        name
        tickets {
          results {
            id
            subject
            status
            labels {
              name
            }
            ref
          }
        }
      }
    }
  }`,
        variables: {}
    }

    const response = await fetch('https://todo.sr.ht/query', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${bearer_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(graphqlQuery)
    })

    const data = await response.json()
    return data;
}
