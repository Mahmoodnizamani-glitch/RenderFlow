package com.renderflow.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.renderflow.ui.screen.editor.EditorScreen
import com.renderflow.ui.screen.projects.ProjectsScreen

@Composable
fun RenderFlowNavHost(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController(),
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Projects.route,
        modifier = modifier,
    ) {
        composable(Screen.Projects.route) {
            ProjectsScreen(
                onProjectClick = { projectId ->
                    navController.navigate(Screen.Editor.createRoute(projectId))
                },
            )
        }
        composable(
            route = Screen.Editor.route,
            arguments = listOf(
                navArgument("projectId") { type = NavType.StringType },
            ),
        ) {
            EditorScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }
    }
}
