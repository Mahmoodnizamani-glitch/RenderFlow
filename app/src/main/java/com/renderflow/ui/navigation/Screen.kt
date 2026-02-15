package com.renderflow.ui.navigation

sealed class Screen(val route: String) {
    data object Projects : Screen("projects")
    data object Editor : Screen("editor/{projectId}") {
        fun createRoute(projectId: String): String = "editor/$projectId"
    }
}
