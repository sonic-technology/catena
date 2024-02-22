// GET /users/[uuid] -> GetUserTypes
// POST /users/[uuid] -> CreateUserTypes
// DELETE /users/[uuid] -> DeleteUserTypes
// PUT /users/[uuid] -> UpdateUserTypes

// GET /users -> GetUsersTypes
// POST /users -> CreateUsersTypes
// DELETE /users/[uuid] -> DeleteUsersTypes
// PUT /users/[uuid] -> UpdateUsersTypes

// GET /users/[uuid]/posts -> GetUserPostsTypes
// POST /users/[uuid]/posts -> CreateUserPostsTypes
// DELETE /users/[uuid]/posts/[uuid] -> DeleteUserPostsTypes

export interface Routes {
    'users.[uuid].get': 'GetUserTypes'
    'users.[uuid].post': 'CreateUserTypes'
    'users.[uuid].delete': 'DeleteUserTypes'
    'users.[uuid].put': 'UpdateUserTypes'
    'users.get': 'GetUsersTypes'
    'users.post': 'CreateUsersTypes'
    'users.delete': 'DeleteUsersTypes'
    'users.put': 'UpdateUsersTypes'
    'users.[uuid].posts.get': 'GetUserPostsTypes'
    'users.[uuid].posts.post': 'CreateUserPostsTypes'
}
